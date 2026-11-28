#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import Table from 'cli-table3';
import { parseBatchADRs } from '../core/adrParser.js';
import { listDecisionFiles } from '../core/decisionLoader.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';
import { calculateGraphRisk } from '../core/risk.js';
import { detectRepoRoot, lintArchitecture, loadNirnayConfig } from '../core/linter.js';
import { generatePRReport } from '../core/report.js';
import { getGoverningDecisionsForFiles, normalizeRepoPath } from '../core/affects.js';
import { startServer } from '../server/serve.js';
import { runInteractiveSession } from './interactive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readCliVersion(): string {
  const candidates = [
    path.resolve(__dirname, '../package.json'),
    path.resolve(__dirname, '../../package.json'),
  ];
  for (const pkgPath of candidates) {
    if (fs.existsSync(pkgPath)) {
      const pkg = fs.readJsonSync(pkgPath) as { version?: string };
      if (pkg.version) return pkg.version;
    }
  }
  return '0.0.0';
}

const program = new Command();

program
  .name('ndag')
  .description('NirnayDAG CLI - Architecture Decision Graph Tool')
  .version(readCliVersion());

// Helper to load and parse ADRs
async function loadAndValidate(dir: string) {
  const fullPath = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    console.error(chalk.red(`Directory not found: ${fullPath}`));
    process.exit(1);
  }
  const { included: files } = await listDecisionFiles(fullPath);
  if (files.length === 0) {
    console.error(chalk.yellow(`No ADR files found in ${fullPath}`));
    process.exit(0);
  }
  const fileData = await Promise.all(
    files.map(async (file) => ({
      name: path.basename(file),
      filePath: path.relative(fullPath, file).replace(/\\/g, '/'),
      content: await fs.readFile(file, 'utf-8'),
    }))
  );
  const parsedADRs = parseBatchADRs(fileData, { baseDir: fullPath });
  const dag = validateAndComputeDAG(parsedADRs);
  return { parsedADRs, ...dag };
}

// 1. validate
program
  .command('validate [dir]')
  .description('Validate the ADR DAG structure')
  .option('--strict', 'fail on warnings', false)
  .option('--strict-refs', 'turn soft mutual references into warnings', false)
  .option('--json', 'Outputs raw JSON')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .action(async (positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    const isStrict = options.strict;
    const strictRefs = options.strictRefs;
    if (isStrict) console.debug(chalk.gray('Strict mode enabled'));
    const { validationResult, parsedADRs } = await loadAndValidate(targetDir);
    const mutualRefs = validationResult.mutualReferences || [];
    const warnings = strictRefs
      ? mutualRefs.map((m) => `Soft mutual reference between ${m.pair[0]} and ${m.pair[1]}`)
      : [];

    if (validationResult.isValid) {
      const hasStrictFailure = isStrict && warnings.length > 0;
      if (options.json || process.env.NDAG_OUTPUT === 'json') {
        console.log(JSON.stringify({
          valid: !hasStrictFailure,
          nodes: parsedADRs.length,
          mutualReferences: mutualRefs,
          ...(warnings.length > 0 ? { warnings } : {}),
        }, null, 2));
        process.exit(hasStrictFailure ? 1 : 0);
      }
      const rootNodes = parsedADRs.filter(adr => !adr.frontmatter.depends_on || adr.frontmatter.depends_on.length === 0);
      console.log(chalk.green(`✅ Architecture DAG validated successfully.`));
      console.log(chalk.green(`   - Total ADRs: ${parsedADRs.length}`));
      console.log(chalk.green(`   - Root Decisions: ${rootNodes.length}`));
      console.log(chalk.green(`   - Zero Cycles: Verified`));
      if (warnings.length > 0) {
        warnings.forEach((w) => console.warn(chalk.yellow(`⚠️  Warning: ${w}`)));
      } else if (mutualRefs.length > 0) {
        console.log(chalk.gray(`   - Mutual References (soft, informational): ${mutualRefs.map(m => `${m.pair[0]} <-> ${m.pair[1]}`).join(', ')}`));
      }
      process.exit(hasStrictFailure ? 1 : 0);
    } else {
      if (options.json || process.env.NDAG_OUTPUT === 'json') {
        console.log(JSON.stringify(validationResult, null, 2));
        process.exit(1);
      }
      console.error(chalk.red(`\n❌ Architecture DAG validation failed.`));
      if (validationResult.hasCycle && validationResult.cyclePath) {
        console.error(chalk.red(`   Circular Dependency Detected!`));
        console.error(chalk.yellow(`   Cycle Path: ${validationResult.cyclePath.join(' -> ')}`));
      }
      if (validationResult.missingDependencies.length > 0) {
        console.error(chalk.red(`   Broken Links Detected (Missing Dependencies):`));
        validationResult.missingDependencies.forEach(m => {
          console.error(chalk.yellow(`   - ${m.adrId} depends on missing ${m.missingId}`));
        });
      }
      if (validationResult.duplicateIds.length > 0) {
        console.error(chalk.red(`   Duplicate IDs Detected:`));
        validationResult.duplicateIds.forEach(d => {
          console.error(chalk.yellow(`   - Duplicate ID "${d.id}" found in: ${d.files.join(', ')}`));
        });
      }
      if (warnings.length > 0) {
        warnings.forEach((w) => console.warn(chalk.yellow(`⚠️  Warning: ${w}`)));
      }
      process.exit(1);
    }
  });

// 2. blast
program
  .command('blast <adrId> [dir]')
  .description('Computes and prints the blast radius for an ADR')
  .option('--json', 'Outputs raw JSON')
  .option('--include-soft', 'Include soft body references in blast radius', false)
  .option('--depth <number>', 'Limits traversal depth', parseInt)
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .action(async (adrId, positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    const { engine } = await loadAndValidate(targetDir);
    const includeSoft = !!options.includeSoft;
    const queryOpts = { includeSoft };
    
    const downstreamIds = engine.getBlastRadius(adrId, queryOpts);
    const direct = engine.getDirectDependents(adrId, queryOpts);
    const alsoReferencedBy = includeSoft ? [] : engine.getSoftDependents(adrId);
    const depth = engine.getDepth(adrId, queryOpts);
    const risk = calculateGraphRisk(engine, adrId);
    const affectedSystems = engine.getAffectedSystems(adrId, queryOpts);
    const affectedSystemsSummary = Object.keys(affectedSystems).map(tag => `${tag} (${affectedSystems[tag].length})`).join(', ') || 'None';
    
    if (options.json || process.env.NDAG_OUTPUT === 'json') {
      console.log(JSON.stringify({
        adrId,
        directDependents: direct.length,
        cascadeCount: downstreamIds.length,
        alsoReferencedBy,
        depth,
        affectedSystems,
        affectedSystemsCount: Object.keys(affectedSystems).length,
        riskModelVersion: risk.modelVersion,
        riskScore: risk.score,
        riskLevel: risk.level,
        riskBreakdown: risk.breakdown
      }, null, 2));
      process.exit(0);
    }
    
    const table = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')] });
    table.push(['ADR ID', adrId]);
    table.push(['Direct Dependents', direct.length]);
    table.push(['Also Referenced By (soft)', alsoReferencedBy.length]);
    table.push(['Cascade Count', downstreamIds.length]);
    table.push(['Max Depth', depth]);
    table.push(['Affected Systems', affectedSystemsSummary]);
    table.push(['Risk Score', `${risk.score}/100 (${risk.level})`]);
    table.push(['Risk Explanation', risk.explanation]);
    
    console.log(table.toString());
    if (downstreamIds.length > 0) {
      console.log(chalk.yellow('\nCascading Impacts:'));
      downstreamIds.forEach(id => console.log(` - ${id}`));
    }
    if (alsoReferencedBy.length > 0) {
      console.log(chalk.gray('\nAlso Referenced By (soft):'));
      alsoReferencedBy.forEach(id => console.log(` - ${id}`));
    }
  });

// 3. serve
program
  .command('serve [dir]')
  .description('Spins up the local web UI to visualize the interactive DAG canvas')
  .option('-p, --port <port>', 'Port to run the server on', '5173')
  .option('--open', 'Automatically open browser')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .action(async (positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    try {
      await startServer({ dir: targetDir, port: options.port, open: options.open });
    } catch (err: any) {
      console.error(chalk.red(`Failed to start NirnayDAG server: ${err.message}`));
      process.exit(1);
    }
  });

// 4. mcp
program
  .command('mcp')
  .description('Starts the stdio MCP server for Google Antigravity / Cursor')
  .action(() => {
    // If running from dist/cli.js, mcp.js is in same dir. If src/cli/index.ts, mcp/server.ts is in ../mcp
    const isDist = __dirname.endsWith('dist');
    if (isDist) {
      const distMcp = path.resolve(__dirname, 'mcp.js');
      spawnSync('node', [distMcp], { stdio: 'inherit' });
    } else {
      const srcMcp = path.resolve(__dirname, '../mcp/server.ts');
      spawnSync('npx', ['tsx', srcMcp], { stdio: 'inherit', shell: true });
    }
  });

// 5. report
program
  .command('report [dir]')
  .description('Generates nirnay-pr-summary.md directly from the terminal for CI workflows')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .action(async (positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    try {
      const result = await generatePRReport({ adrDir: targetDir });

      if (process.env.ANTIGRAVITY_SESSION) {
        const reportPath = path.resolve(process.cwd(), result.summaryFile);
        if (fs.existsSync(reportPath)) {
          const artifactsDir = path.resolve(process.cwd(), '.antigravity', 'artifacts');
          fs.ensureDirSync(artifactsDir);
          fs.copyFileSync(reportPath, path.join(artifactsDir, 'nirnay-pr-summary.md'));
          console.log(chalk.green(`\nArtifact saved to .antigravity/artifacts/nirnay-pr-summary.md`));
        }
      }
    } catch (err: any) {
      console.error(chalk.red(`Failed to generate PR blast radius report: ${err.message}`));
      process.exit(1);
    }
  });

// 6. interactive
program
  .command('interactive [dir]')
  .alias('i')
  .description('Launch interactive TUI session')
  .option('--json', 'Outputs raw JSON instead of TUI')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .action(async (positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    
    const isJson = options.json || process.env.NDAG_OUTPUT === 'json';
    const isTTY = process.stdout.isTTY;
    const isAntigravity = !!process.env.ANTIGRAVITY_SESSION;
    
    if (isJson || !isTTY || isAntigravity) {
      // Graceful fallback to JSON output
      const { engine, mappedAdrs } = await loadAndValidate(targetDir);
      const output = {
        adrs: mappedAdrs,
        validation: engine.validate()
      };
      console.log(JSON.stringify(output, null, 2));
      process.exit(0);
    }
    
    await runInteractiveSession(targetDir);
  });

// 7. lint
program
  .command('lint [dir]')
  .description('Run architecture decision lint rules')
  .option('--json', 'Outputs raw JSON')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .option('--root <path>', 'Repository root directory override')
  .action(async (positionalDir, options) => {
    const targetDir = options.dir || positionalDir || process.env.ADR_DIR || './docs/adr';
    const resolvedAdrDir = path.resolve(process.cwd(), targetDir);
    const effectiveRoot = options.root
      ? path.resolve(process.cwd(), options.root)
      : detectRepoRoot(resolvedAdrDir);
    const { engine, mappedAdrs } = await loadAndValidate(targetDir);
    const config = await loadNirnayConfig(targetDir, effectiveRoot);
    const result = lintArchitecture(mappedAdrs, engine, config, { repoRoot: effectiveRoot });
    const isJson = Boolean(options.json || process.env.NDAG_OUTPUT === 'json');

    if (isJson) {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.hasErrors ? 1 : 0);
    }

    if (effectiveRoot === null) {
      console.log(
        chalk.blue(
          'ℹ️  No repository root (.git or .nirnayrc.json) found; skipping affects-no-match and deprecated-governs-code rules.'
        )
      );
    }

    if (result.findings.length === 0) {
      console.log(chalk.green(`✅ No lint issues found across ${mappedAdrs.length} ADRs.`));
      process.exit(0);
    }

    const table = new Table({
      head: [chalk.cyan('Severity'), chalk.cyan('Rule'), chalk.cyan('Files'), chalk.cyan('Message')],
    });

    for (const finding of result.findings) {
      const sevLabel =
        finding.severity === 'error'
          ? chalk.red('error')
          : finding.severity === 'warn'
          ? chalk.yellow('warn')
          : chalk.blue('info');
      table.push([sevLabel, finding.ruleId, finding.files.join(', '), finding.message]);
    }

    console.log(table.toString());
    console.log(
      `\nSummary: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.infos} info(s)`
    );
    process.exit(result.hasErrors ? 1 : 0);
  });

// 8. why
program
  .command('why <files...>')
  .description('Show architectural decisions governing one or more repo-relative files')
  .option('--json', 'Outputs raw JSON')
  .option('-d, --dir <path>', 'Directory containing ADR markdown files')
  .option('--root <path>', 'Repository root directory override')
  .action(async (rawFiles: string[], options) => {
    let targetDir = options.dir || process.env.ADR_DIR || './docs/adr';
    let fileArgs = rawFiles;

    if (!options.dir && rawFiles.length >= 2) {
      const lastArg = rawFiles[rawFiles.length - 1];
      const resolvedLast = path.resolve(process.cwd(), lastArg);
      if (fs.existsSync(resolvedLast) && fs.statSync(resolvedLast).isDirectory()) {
        targetDir = lastArg;
        fileArgs = rawFiles.slice(0, -1);
      }
    }

    const resolvedAdrDir = path.resolve(process.cwd(), targetDir);
    const effectiveRoot = options.root
      ? path.resolve(process.cwd(), options.root)
      : (detectRepoRoot(resolvedAdrDir) ?? process.cwd());

    const normalizedFiles = fileArgs.map((f) => {
      if (path.isAbsolute(f)) {
        const rel = path.relative(effectiveRoot, f);
        return normalizeRepoPath(rel);
      }
      return normalizeRepoPath(f);
    });

    const { engine, mappedAdrs } = await loadAndValidate(targetDir);
    const results = getGoverningDecisionsForFiles(normalizedFiles, mappedAdrs, engine);

    if (options.json || process.env.NDAG_OUTPUT === 'json') {
      console.log(
        JSON.stringify(
          {
            adrDir: targetDir,
            results,
          },
          null,
          2
        )
      );
      process.exit(0);
    }

    for (const item of results) {
      console.log(chalk.cyan.bold(`\n${item.file}`));
      if (item.decisions.length === 0) {
        console.log(chalk.gray('  No governing decisions found.'));
        continue;
      }

      for (const dec of item.decisions) {
        const statusBadge = dec.isDeprecatedOrSuperseded
          ? chalk.yellow(`⚠️  ${dec.status}`)
          : chalk.green(dec.status);
        console.log(
          `  ${chalk.bold(dec.id)} — ${dec.title} [${statusBadge}] ${chalk.gray(`(glob: ${dec.matchingGlob})`)}`
        );
        if (dec.ancestors.length > 0) {
          const ancestorStr = dec.ancestors
            .map((a) => `${a.id} (${a.status})`)
            .join(', ');
          console.log(chalk.gray(`    Upstream constraints: ${ancestorStr}`));
        }
      }
    }
    console.log('');
    process.exit(0);
  });

program.parse(process.argv);
