#!/usr/bin/env tsx
import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, spawnSync } from 'child_process';
import chalk from 'chalk';
import glob from 'fast-glob';
import Table from 'cli-table3';
import { parseBatchADRs } from '../core/adrParser.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('ndag')
  .description('NirnayDAG CLI - Architecture Decision Graph Tool')
  .version('0.1.0');

// Helper to load and parse ADRs
async function loadAndValidate(dir: string) {
  const fullPath = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    console.error(chalk.red(`Directory not found: ${fullPath}`));
    process.exit(1);
  }
  const files = await glob('**/*.{md,mdx}', { cwd: fullPath, absolute: true });
  if (files.length === 0) {
    console.error(chalk.yellow(`No ADR files found in ${fullPath}`));
    process.exit(0);
  }
  const fileData = await Promise.all(
    files.map(async (file) => ({
      name: path.basename(file),
      content: await fs.readFile(file, 'utf-8'),
    }))
  );
  const parsedADRs = parseBatchADRs(fileData);
  const dag = validateAndComputeDAG(parsedADRs);
  return { parsedADRs, ...dag };
}

// 1. validate
program
  .command('validate [dir]')
  .description('Validate the ADR DAG structure')
  .option('--strict', 'fail on warnings', false)
  .action(async (dir = './adrs', options) => {
    const isStrict = options.strict;
    if (isStrict) console.debug(chalk.gray('Strict mode enabled'));
    const { validationResult, parsedADRs } = await loadAndValidate(dir);

    if (validationResult.isValid) {
      const rootNodes = parsedADRs.filter(adr => !adr.frontmatter.depends_on || adr.frontmatter.depends_on.length === 0);
      console.log(chalk.green(`✅ Architecture DAG validated successfully.`));
      console.log(chalk.green(`   - Total ADRs: ${parsedADRs.length}`));
      console.log(chalk.green(`   - Root Decisions: ${rootNodes.length}`));
      console.log(chalk.green(`   - Zero Cycles: Verified`));
      process.exit(0);
    } else {
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
      process.exit(1);
    }
  });

// 2. blast
program
  .command('blast <adrId> [dir]')
  .description('Computes and prints the blast radius for an ADR')
  .option('--json', 'Outputs raw JSON')
  .option('--depth <number>', 'Limits traversal depth', parseInt)
  .action(async (adrId, dir = './adrs', options) => {
    const { engine, mappedAdrs } = await loadAndValidate(dir);
    
    const downstreamIds = engine.getBlastRadius(adrId);
    const direct = mappedAdrs.find(a => a.id === adrId)?.dependencies || [];
    const score = Math.min(100, downstreamIds.length * 10 + direct.length * 5);
    
    if (options.json) {
      console.log(JSON.stringify({ adrId, directDependents: direct.length, cascadeCount: downstreamIds.length, riskScore: score }, null, 2));
      process.exit(0);
    }
    
    const table = new Table({ head: [chalk.cyan('Metric'), chalk.cyan('Value')] });
    table.push(['ADR ID', adrId]);
    table.push(['Direct Dependents', direct.length]);
    table.push(['Cascade Count', downstreamIds.length]);
    table.push(['Risk Score', score]);
    
    console.log(table.toString());
    if (downstreamIds.length > 0) {
      console.log(chalk.yellow('\nCascading Impacts:'));
      downstreamIds.forEach(id => console.log(` - ${id}`));
    }
  });

// 3. serve
program
  .command('serve [dir]')
  .description('Spins up the local web UI to visualize the interactive DAG canvas')
  .option('-p, --port <port>', 'Port to run the server on', '5173')
  .option('--open', 'Automatically open browser')
  .action((dir = './adrs', options) => {
    console.log(chalk.cyan(`Starting NirnayDAG UI on port ${options.port} for ADRs in ${dir}...`));
    const args = ['run', 'dev', '--', '--port', options.port];
    if (options.open) args.push('--open');
    spawn('npm', args, { stdio: 'inherit', shell: true, env: { ...process.env, ADR_DIR: dir } });
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
  .action((dir = './adrs') => {
    const isDist = __dirname.endsWith('dist');
    const projectRoot = isDist ? path.resolve(__dirname, '..') : path.resolve(__dirname, '../../');
    const scriptPath = path.join(projectRoot, 'scripts/pr-blast-radius.ts');
    
    spawnSync('npx', ['tsx', scriptPath, dir], { 
      stdio: 'inherit', 
      shell: true, 
      env: { ...process.env, ADR_DIR: dir } 
    });
  });

program.parse(process.argv);
