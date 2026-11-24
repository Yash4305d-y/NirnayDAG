import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import fg from 'fast-glob';
import { parseBatchADRs } from './adrParser.js';
import { validateAndComputeDAG, type DAGValidationResult } from './dagEngine.js';
import { calculateArchitectureRisk } from './risk.js';
import type { ParsedADR } from './types.js';

export interface ReportOptions {
  adrDir?: string;
  outputFile?: string;
  baseRef?: string;
  mockChangedFiles?: string[];
  cwd?: string;
}

export interface ReportResult {
  markdown: string;
  summaryFile: string;
  changedCount: number;
  totalCount: number;
  validationResult: DAGValidationResult;
  changedAdrs: ParsedADR[];
}

export async function generatePRReport(options: ReportOptions = {}): Promise<ReportResult> {
  const cwd = options.cwd || process.cwd();
  const adrDir = options.adrDir || process.env.ADR_DIR || './docs/adr';
  const fullPath = path.isAbsolute(adrDir) ? adrDir : path.resolve(cwd, adrDir);
  const summaryFile = options.outputFile
    ? (path.isAbsolute(options.outputFile) ? options.outputFile : path.resolve(cwd, options.outputFile))
    : path.resolve(cwd, 'nirnay-pr-summary.md');

  // 1. Git Diff & Change Detection
  const baseRef = options.baseRef || process.env.GITHUB_BASE_REF || 'origin/main';
  let changedFilesList: string[] = [];

  if (options.mockChangedFiles && options.mockChangedFiles.length > 0) {
    changedFilesList = options.mockChangedFiles;
  } else if (process.env.MOCK_CHANGED_FILES) {
    changedFilesList = process.env.MOCK_CHANGED_FILES.split(',');
  } else {
    try {
      const diffOut = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf-8', cwd });
      changedFilesList = diffOut.split('\n').filter(Boolean);
    } catch (e: any) {
      console.warn(`⚠️ Could not detect changed files via git (${e.message}). Proceeding with all ADRs for report.`);
    }
  }

  // 2. Parse ADRs
  if (!fs.existsSync(fullPath)) {
    console.warn(`Directory not found: ${fullPath}`);
    const notFoundMd = `*ADR directory not found.*`;
    await fs.writeFile(summaryFile, notFoundMd, 'utf-8');
    return {
      markdown: notFoundMd,
      summaryFile,
      changedCount: 0,
      totalCount: 0,
      validationResult: { isValid: false, hasCycle: false, missingDependencies: [], topologicalOrder: [] },
      changedAdrs: [],
    };
  }

  const files = await fg('**/*.{md,mdx}', { cwd: fullPath, absolute: true });
  const fileData = await Promise.all(
    files.map(async (file) => ({
      name: path.basename(file),
      content: await fs.readFile(file, 'utf-8'),
      absPath: file.replace(/\\/g, '/'),
    }))
  );

  const parsedADRs = parseBatchADRs(fileData);
  const { validationResult, engine } = validateAndComputeDAG(parsedADRs);

  // Identify changed ADRs
  let changedAdrs = parsedADRs;
  if (changedFilesList.length > 0) {
    changedAdrs = parsedADRs.filter((_adr, idx) => {
      const fileObj = fileData[idx];
      return changedFilesList.some(
        (cf) =>
          fileObj.absPath.endsWith(cf.replace(/\\/g, '/')) ||
          cf.replace(/\\/g, '/').endsWith(fileObj.name)
      );
    });
  }

  // 3. Generate Markdown PR Comment
  let md = `# Architecture Decision Graph (ADR) Blast Radius\n\n`;

  if (!validationResult.isValid) {
    md += `> [!CAUTION]\n`;
    md += `> **Architecture DAG Validation Failed!**\n`;
    if (validationResult.hasCycle && validationResult.cyclePath) {
      md += `> \n> **Circular Dependency Detected:**\n`;
      md += `> \`${validationResult.cyclePath.join(' -> ')}\`\n`;
    }
    if (validationResult.missingDependencies.length > 0) {
      md += `> \n> **Broken Links Detected:**\n`;
      validationResult.missingDependencies.forEach((dep) => {
        md += `> - ${dep.adrId} requires missing parent ${dep.missingId}\n`;
      });
    }
    md += `\n`;
  } else {
    md += `> [!NOTE]\n> **Architecture DAG Validated Successfully** (0 Cycles, ${parsedADRs.length} Total ADRs)\n\n`;
  }

  if (changedAdrs.length === 0) {
    md += `*No ADR files were modified in this PR.*\n`;
  } else {
    md += `### Modified ADRs Impact Analysis\n\n`;
    md += `| ADR ID | Title | Status | Cascade Count | Max Depth | Affected Systems | Risk Level |\n`;
    md += `|--------|-------|--------|---------------|-----------|------------------|------------|\n`;

    const impactDetails: { id: string; title: string; downstream: string[] }[] = [];

    changedAdrs.forEach((adr) => {
      const id = adr.frontmatter.id;
      const title = adr.frontmatter.title || 'Untitled';
      const status = adr.frontmatter.status;

      const downstreamIds = engine.getBlastRadius(id);
      const direct = engine.getDirectDependents(id);
      const maxDepth = engine.getDepth(id);
      const affectedSystems = engine.getAffectedSystems(id);
      const affectedSummary = Object.keys(affectedSystems).join(', ') || 'None';
      const risk = calculateArchitectureRisk({
        directDependentsCount: direct.length,
        cascadeCount: downstreamIds.length,
        depth: maxDepth,
      });

      const riskLevel =
        risk.level === 'High' ? '🔴 High' : risk.level === 'Medium' ? '🟡 Medium' : '🟢 Low';

      md += `| **${id}** | ${title} | ${status} | ${downstreamIds.length} | ${maxDepth} | ${affectedSummary} | ${riskLevel} (${risk.score}) |\n`;

      if (downstreamIds.length > 0) {
        impactDetails.push({ id, title, downstream: downstreamIds });
      }
    });

    if (impactDetails.length > 0) {
      md += `\n### Downstream Impact Details\n\n`;
      impactDetails.forEach((detail) => {
        md += `<details>\n`;
        md += `<summary><strong>${detail.id} (${detail.title})</strong> cascades to ${detail.downstream.length} decisions</summary>\n\n`;
        md += `- ` + detail.downstream.join('\n- ') + `\n\n`;
        md += `</details>\n`;
      });
    }
  }

  await fs.writeFile(summaryFile, md, 'utf-8');
  console.log(`Successfully wrote PR blast radius summary to ${summaryFile}`);

  return {
    markdown: md,
    summaryFile,
    changedCount: changedAdrs.length,
    totalCount: parsedADRs.length,
    validationResult,
    changedAdrs,
  };
}
