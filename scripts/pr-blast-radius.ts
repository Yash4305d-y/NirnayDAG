import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import fg from 'fast-glob';
import { parseBatchADRs } from '../src/core/adrParser.js';
import { validateAndComputeDAG } from '../src/core/dagEngine.js';
import { calculateArchitectureRisk } from '../src/core/risk.js';

async function main() {
  const adrDir = process.env.ADR_DIR || process.argv[2] || './adrs';
  const fullPath = path.resolve(process.cwd(), adrDir);
  const summaryFile = path.resolve(process.cwd(), 'nirnay-pr-summary.md');

  // 1. Git Diff & Change Detection
  const baseRef = process.env.GITHUB_BASE_REF || 'origin/main';
  let changedFilesList: string[] = [];
  
  if (process.env.MOCK_CHANGED_FILES) {
    changedFilesList = process.env.MOCK_CHANGED_FILES.split(',');
  } else {
    try {
      const diffOut = execSync(`git diff --name-only ${baseRef}...HEAD`, { encoding: 'utf-8' });
      changedFilesList = diffOut.split('\n').filter(Boolean);
    } catch (e: any) {
      console.warn(`⚠️ Could not detect changed files via git (${e.message}). Proceeding with all ADRs for report.`);
    }
  }

  // 2. Parse ADRs
  if (!fs.existsSync(fullPath)) {
    console.warn(`Directory not found: ${fullPath}`);
    await fs.writeFile(summaryFile, `*ADR directory not found.*`, 'utf-8');
    process.exit(0);
  }

  const files = await fg('**/*.{md,mdx}', { cwd: fullPath, absolute: true });
  const fileData = await Promise.all(
    files.map(async (file) => ({
      name: path.basename(file),
      content: await fs.readFile(file, 'utf-8'),
      absPath: file.replace(/\\/g, '/')
    }))
  );

  const parsedADRs = parseBatchADRs(fileData);
  const { validationResult, engine } = validateAndComputeDAG(parsedADRs);

  // Identify changed ADRs
  let changedAdrs = parsedADRs;
  if (changedFilesList.length > 0) {
    changedAdrs = parsedADRs.filter((adr, idx) => {
      const fileObj = fileData[idx];
      return changedFilesList.some(cf => fileObj.absPath.endsWith(cf.replace(/\\/g, '/')) || cf.replace(/\\/g, '/').endsWith(fileObj.name));
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
      validationResult.missingDependencies.forEach(dep => {
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
    md += `| ADR ID | Title | Status | Cascade Count | Max Depth | Risk Level |\n`;
    md += `|--------|-------|--------|---------------|-----------|------------|\n`;

    const impactDetails: { id: string; title: string; downstream: string[] }[] = [];

    changedAdrs.forEach(adr => {
      const id = adr.frontmatter.id;
      const title = adr.frontmatter.title || 'Untitled';
      const status = adr.frontmatter.status;
      
      const downstreamIds = engine.getBlastRadius(id);
      const direct = engine.getDirectDependents(id);
      const maxDepth = engine.getDepth(id); 
      const risk = calculateArchitectureRisk({ directDependentsCount: direct.length, cascadeCount: downstreamIds.length, depth: maxDepth });

      const riskLevel = risk.level === 'High' ? '🔴 High' : risk.level === 'Medium' ? '🟡 Medium' : '🟢 Low';

      md += `| **${id}** | ${title} | ${status} | ${downstreamIds.length} | ${maxDepth} | ${riskLevel} (${risk.score}) |\n`;

      if (downstreamIds.length > 0) {
        impactDetails.push({ id, title, downstream: downstreamIds });
      }
    });

    if (impactDetails.length > 0) {
      md += `\n### Downstream Impact Details\n\n`;
      impactDetails.forEach(detail => {
        md += `<details>\n`;
        md += `<summary><strong>${detail.id} (${detail.title})</strong> cascades to ${detail.downstream.length} decisions</summary>\n\n`;
        md += `- ` + detail.downstream.join('\n- ') + `\n\n`;
        md += `</details>\n`;
      });
    }
  }

  await fs.writeFile(summaryFile, md, 'utf-8');
  console.log(`Successfully wrote PR blast radius summary to ${summaryFile}`);
}

main().catch(err => {
  console.error("Failed to generate PR blast radius report", err);
  process.exit(1);
});
