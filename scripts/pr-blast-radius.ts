import { execSync } from 'child_process';
import fs from 'fs-extra';
import * as path from 'path';
import { DAGEngine } from '../src/core/dagEngine.js';
import { parseADRMarkdown } from '../src/parser/adrParser.js';

const ADRS_DIR = path.resolve(process.cwd(), 'adrs');
const OUTPUT_FILE = path.resolve(process.cwd(), 'nirnay-pr-summary.md');

// 1. Find changed files
let changedFiles: string[] = [];
try {
  // Uses target base branch from GitHub actions, fallback to origin/main
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
  const diffOutput = execSync(`git diff ${baseRef}...HEAD --name-only adrs/`, { encoding: 'utf8' });
  changedFiles = diffOutput.split('\n').filter(Boolean).filter(f => f.endsWith('.md'));
} catch (e) {
  console.warn('Could not run git diff (maybe not in a git repo or missing origin/main). Defaulting to scanning all adrs/ for demo.');
  // Fallback for local testing or initial commits
  if (fs.existsSync(ADRS_DIR)) {
    changedFiles = fs.readdirSync(ADRS_DIR).filter(f => f.endsWith('.md')).map(f => `adrs/${f}`);
  }
}

// 2. Load current ADRs and build DAGEngine
const adrs = [];
if (fs.existsSync(ADRS_DIR)) {
  const allFiles = fs.readdirSync(ADRS_DIR).filter(f => f.endsWith('.md'));
  for (const file of allFiles) {
    const raw = fs.readFileSync(path.join(ADRS_DIR, file), 'utf-8');
    adrs.push(parseADRMarkdown(raw));
  }
}

const engine = new DAGEngine(adrs);
const validation = engine.validate();

const changedAdrIds: string[] = [];
for (const file of changedFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const parsed = parseADRMarkdown(raw);
    changedAdrIds.push(parsed.id);
  }
}

// 3. Build Markdown Report
let markdown = `## ☸️ NirnayDAG Architecture Review\n\n`;

markdown += `| Status | Validation Check | Result |\n`;
markdown += `|---|---|---|\n`;
markdown += `| ${validation.hasCycle ? '🔴' : '🟢'} | **DAG Cycle Detection** | ${validation.hasCycle ? `Failed (Cycle: ${validation.cyclePath?.join(' -> ')})` : 'Passed (No circular dependencies)'} |\n`;
markdown += `| ${validation.missingDependencies.length > 0 ? '🔴' : '🟢'} | **Schema & Frontmatter** | ${validation.missingDependencies.length > 0 ? `Failed (${validation.missingDependencies.length} missing refs)` : 'Passed (All references valid)'} |\n\n`;

if (changedAdrIds.length > 0) {
  markdown += `### 💥 Blast Radius Impact Analysis\n`;
  markdown += `The following ADRs were modified in this PR:\n\n`;
  markdown += `| Modified Decision | Status | Direct / Transitive Downstream Impact |\n`;
  markdown += `|---|---|---|\n`;

  const impactedGlobal = new Set<string>();

  for (const adrId of changedAdrIds) {
    const adr = adrs.find(a => a.id === adrId);
    if (!adr) continue;
    
    const impacted = engine.getBlastRadius(adrId);
    impacted.forEach(i => impactedGlobal.add(i));
    
    if (impacted.length > 0) {
      markdown += `| **${adrId}** (${adr.title}) | \`${adr.status}\` | ⚠️ **${impacted.length} nodes affected:** ${impacted.map(i => '\`' + i + '\`').join(', ')} |\\n`;
    } else {
      markdown += `| **${adrId}** (${adr.title}) | \`${adr.status}\` | 🟢 No downstream nodes affected. |\n`;
    }
  }

  // Generate Mermaid Graph
  if (impactedGlobal.size > 0 || changedAdrIds.length > 0) {
    markdown += `\n\`\`\`mermaid\ngraph TD\n`;
    
    const nodesToRender = new Set<string>([...changedAdrIds, ...impactedGlobal]);
    
    adrs.forEach(adr => {
      adr.dependencies.forEach(dep => {
        if (nodesToRender.has(adr.id) || nodesToRender.has(dep)) {
          nodesToRender.add(adr.id);
          nodesToRender.add(dep);
          
          let targetClass = '';
          if (changedAdrIds.includes(adr.id)) targetClass = ':::modified';
          else if (impactedGlobal.has(adr.id)) targetClass = ':::impacted';
          
          let sourceClass = '';
          if (changedAdrIds.includes(dep)) sourceClass = ':::modified';
          else if (impactedGlobal.has(dep)) sourceClass = ':::impacted';

          markdown += `  ${dep}[${dep}]${sourceClass} --> ${adr.id}[${adr.id}]${targetClass}\n`;
        }
      });
    });

    markdown += `\n  classDef modified fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff;\n`;
    markdown += `  classDef impacted fill:#ef4444,stroke:#b91c1c,stroke-width:2px,color:#fff;\n`;
    markdown += `\`\`\`\n`;
  }

} else {
  markdown += `### 💥 Blast Radius Impact Analysis\n`;
  markdown += `No ADRs were modified in this PR.\n`;
}

// 4. Write to temp file
fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');
console.log(`Successfully generated PR summary at ${OUTPUT_FILE}`);
