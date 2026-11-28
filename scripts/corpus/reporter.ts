import path from 'path';
import fs from 'fs-extra';
import type { CorpusBenchmarkReport, CorpusEvidenceReport } from './types.js';

export async function writeCorpusResultsJson(
  report: CorpusBenchmarkReport,
  outputPath?: string
): Promise<string> {
  const target = outputPath || path.resolve(process.cwd(), 'results', 'corpus-results.json');
  await fs.ensureDir(path.dirname(target));
  await fs.writeFile(target, JSON.stringify(report, null, 2), 'utf-8');
  return target;
}

export async function writeEvidenceJson(
  evidence: CorpusEvidenceReport,
  outputPath?: string
): Promise<string> {
  const target = outputPath || path.resolve(process.cwd(), 'results', 'evidence.json');
  await fs.ensureDir(path.dirname(target));
  await fs.writeFile(target, JSON.stringify(evidence, null, 2), 'utf-8');
  return target;
}

export function generateFindingsMarkdown(report: CorpusBenchmarkReport): string {
  const { summary, results, droppedRepositories, timestamp, licenseNotice } = report;

  const minDensity = results.length > 0 ? Math.min(...results.map((r) => r.edgeDensity)) : 0;
  const maxDensity = results.length > 0 ? Math.max(...results.map((r) => r.edgeDensity)) : 0;
  const totalIsolated = results.reduce((acc, r) => acc + r.isolatedNodes, 0);

  const isPhase2c2a = summary.totalExcludedFiles !== undefined;

  const tableHeader = isPhase2c2a
    ? `| Repository | Commit | Format | License | Files Found | Excluded | Decision Nodes | Nodes (Before → After) | Edges (Hard / Soft) | Mutual Refs | Hard Cycles | Resolved / Non-decision / Outside-scope / Ambiguous / Truly Broken | Truly Broken (Before → After) | Real Title % | Title Source (FM / H1 / Meta / KEP / Slug) | Status Found % | Status Source (FM / Sec / Line / KEP) |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`
    : `| Repository | Commit | Format | License | Files Found | Parsed OK | Parse Rate | Real Title % | Title Source (FM / H1 / Meta / KEP / Slug) | Status Found % | Status Source (FM / Sec / Line / KEP) | ID Source (FM / File / Gen) | Duplicate IDs | Unique IDs | Nodes | Edges (Hard / Soft) | Edge Density | Isolated Nodes | Hard Cycles | Mutual Refs | Broken Links | Analysis Time | Checkout Time (cached) |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`;

  const tableRows = results
    .map((r) => {
      const shortSha = r.commitSha ? `\`${r.commitSha.substring(0, 7)}\`` : '`unknown`';
      const eq = r.extractionQuality;
      const titleSourceDisplay = `${eq.titleFromFrontmatterPercent ?? 0}% / ${eq.titleFromHeadingPercent ?? 0}% / ${eq.titleFromMetadataLinePercent ?? 0}% / ${eq.titleFromKepYamlPercent ?? 0}% / ${eq.titleFromSlugPercent ?? 0}%`;
      const statusSourceDisplay = `${eq.statusFromFrontmatterPercent ?? 0}% / ${eq.statusFromSectionPercent ?? 0}% / ${eq.statusFromLinePercent ?? 0}% / ${eq.statusFromKepYamlPercent ?? 0}%`;
      const edgesDisplay = `${r.hardEdges} / ${r.softEdges}`;
      const cycleDisplay = r.cyclesFound ? `Detected (${r.cyclePath?.length || 0} nodes)` : 'None';
      const mutualDisplay = `${r.mutualReferencesCount}`;
      if (isPhase2c2a) {
        const excluded = r.excludedCount ?? 0;
        const beforeNodes = r.before?.nodes !== undefined ? `${r.before.nodes}` : '—';
        const nodesCompare = `${beforeNodes} → ${r.nodes}`;
        const linkBreakdown = `${r.resolvedLinks ?? 0} / ${r.nonDecisionLinks ?? 0} / ${r.outsideScopeLinks ?? 0} / ${r.ambiguousLinks ?? 0} / ${r.brokenLinks}`;
        const beforeBroken = r.before ? `${r.before.brokenLinks}` : '—';
        const brokenCompare = `${beforeBroken} → ${r.brokenLinks}`;
        return `| [${r.repo}](${r.url}) | ${shortSha} | \`${r.format}\` | ${r.license} | ${r.filesFound} | ${excluded} | ${r.nodes} | ${nodesCompare} | ${edgesDisplay} | ${mutualDisplay} | ${cycleDisplay} | ${linkBreakdown} | ${brokenCompare} | ${eq.realTitlePercent}% | ${titleSourceDisplay} | ${eq.statusFoundPercent}% | ${statusSourceDisplay} |`;
      }
      const idSourceDisplay = `${eq.idFromFrontmatterPercent}% / ${eq.idFromFilenamePercent}% / ${eq.idGeneratedPercent}%`;
      const brokenDisplay = `${r.brokenLinks}`;
      return `| [${r.repo}](${r.url}) | ${shortSha} | \`${r.format}\` | ${r.license} | ${r.filesFound} | ${r.filesParsedOK} | ${r.parseRatePercent}% | ${eq.realTitlePercent}% | ${titleSourceDisplay} | ${eq.statusFoundPercent}% | ${statusSourceDisplay} | ${idSourceDisplay} | ${r.duplicateIdsCount} | ${r.uniqueIdsCount} | ${r.nodes} | ${edgesDisplay} | ${r.edgeDensity} | ${r.isolatedNodes} | ${cycleDisplay} | ${mutualDisplay} | ${brokenDisplay} | ${r.timing.analysisMs}ms | ${r.timing.cloneMs}ms |`;
    })
    .join('\n');

  const extractionComparisonRows = results
    .map((r) => {
      const beforeTitle = r.before?.realTitlePercent !== undefined ? `${r.before.realTitlePercent}%` : '—';
      const beforeStatus = r.before?.statusFoundPercent !== undefined ? `${r.before.statusFoundPercent}%` : '—';
      const beforeHard = r.before?.hardEdges !== undefined ? `${r.before.hardEdges}` : '—';
      return `| **${r.repo}** | ${beforeTitle} → ${r.extractionQuality.realTitlePercent}% | ${beforeStatus} → ${r.extractionQuality.statusFoundPercent}% | ${beforeHard} → ${r.hardEdges} |`;
    })
    .join('\n');

  const topFailureSections = results
    .filter((r) => r.topFailureReasons.length > 0)
    .map((r) => {
      const reasonsList = r.topFailureReasons
        .slice(0, 3)
        .map((f) => `  - *${f.reason}* (${f.count} occurrence${f.count > 1 ? 's' : ''})`)
        .join('\n');
      return `#### ${r.repo} (${r.parseFailuresCount} parse failure${r.parseFailuresCount > 1 ? 's' : ''})\n${reasonsList}`;
    })
    .join('\n\n');

  const cycleValidationItems = results
    .filter((r) => r.cyclesFound)
    .map((r) => `- [ ] **${r.repo}** — Verify cycle path \`${(r.cyclePath || []).join(' -> ')}\` in \`results/evidence.json\``)
    .join('\n');

  const brokenLinkValidationItems = results
    .filter((r) => r.brokenLinks > 0)
    .map((r) => `- [ ] **${r.repo}** — Review sample of ${Math.min(10, r.brokenLinks)} of ${r.brokenLinks} broken link(s) in \`results/evidence.json\``)
    .join('\n');

  const linkComparisonRows = results
    .map((r) => {
      const resolved = r.resolvedLinks ?? 0;
      const nonDecision = r.nonDecisionLinks ?? 0;
      const outsideScope = r.outsideScopeLinks ?? 0;
      const ambiguous = r.ambiguousLinks ?? 0;
      const beforeEdges = r.before ? `${r.before.edges}` : '—';
      const beforeBroken = r.before ? `${r.before.brokenLinks}` : '—';
      return `| **${r.repo}** | ${resolved} | ${nonDecision} | ${outsideScope} | ${ambiguous} | ${r.brokenLinks} | ${beforeEdges} → ${r.edges} | ${beforeBroken} → ${r.brokenLinks} |`;
    })
    .join('\n');

  const lintRows = results
    .map((r) => {
      const byRule = r.lintSummary?.byRule;
      const dep = byRule?.['accepted-depends-on-deprecated'] ?? 0;
      const sup = byRule?.['superseded-without-successor'] ?? 0;
      const brk = byRule?.['broken-supersedes'] ?? 0;
      const orp = byRule?.orphan ?? 0;
      return `| **${r.repo}** | ${dep} | ${sup} | ${brk} | ${orp} | ${r.lintSummary?.total ?? 0} |`;
    })
    .join('\n');

  const totalLint = summary.totalLintByRule;
  const lintTotalRow = `| **Total** | **${totalLint?.['accepted-depends-on-deprecated'] ?? 0}** | **${totalLint?.['superseded-without-successor'] ?? 0}** | **${totalLint?.['broken-supersedes'] ?? 0}** | **${totalLint?.orphan ?? 0}** | **${(totalLint?.['accepted-depends-on-deprecated'] ?? 0) + (totalLint?.['superseded-without-successor'] ?? 0) + (totalLint?.['broken-supersedes'] ?? 0) + (totalLint?.orphan ?? 0)}** |`;

  const droppedRows = droppedRepositories
    .map((d) => `| [${d.name}](${d.url}) | ${d.license} | **Dropped** | ${d.reason} |`)
    .join('\n');

  const formatList = Array.from(new Set(results.map((r) => `\`${r.format}\``))).join(', ');

  return `# NirnayDAG Corpus Benchmark Findings (Phase 2A.2 + 2B)

> Benchmark Executed: ${timestamp}  
> Runner Version: \`${report.runnerVersion}\`  
> Scope: Hard vs. Soft dependency edge classification and Data-Integrity Fixes across pinned open-source decision-record commits.

---

## 1. Executive Summary

NirnayDAG's parser and DAG engine were run against **${summary.totalReposAnalyzed} open-source repositories** pinned to exact commit SHAs across ${formatList} formats.

- **Total Decision Files Found:** ${summary.totalFilesFound}
- **Parsed OK:** ${summary.totalFilesParsedOK} (${summary.averageParseRatePercent}%) — *see definition below*
- **Total Graph Nodes:** ${summary.totalNodes} (${summary.totalUniqueIds} unique IDs; ${summary.totalDuplicateIds} files with initial ID collisions before disambiguation)
- **Total Active Graph Edges:** ${summary.totalEdges} (${summary.totalHardEdges} hard, ${summary.totalSoftEdges} soft)
- **Total Isolated Nodes:** ${totalIsolated}
- **Unresolved References (Broken Links):** ${summary.totalBrokenLinks} (unvalidated)
- **Repositories with Hard Cycles:** ${summary.totalCyclesDetected}
- **Soft Mutual References:** ${summary.totalMutualReferences} pair(s) (informational, non-failing)

> **Definition — "Parsed OK":** A non-empty file where \`parseADRContent()\` did not throw and returned a non-null \`ParsedADR\` object with a non-empty \`frontmatter.id\` (whether from frontmatter, filename fallback, or generated ID). **"Parsed OK" measures parser survival, not metadata extraction quality**—which is reported separately in the extraction-quality columns immediately next to it.

### Data Quality

In Phase 2A.1, \`kubernetes/enhancements\` had 708 markdown files, 689 of which were named \`README.md\` inside KEP subdirectories. All 689 received the fallback ID \`"README"\`, and \`DAGEngine\`'s \`Map\` silently overwrote colliding entries—collapsing 708 files down to 19 graph nodes while the corpus report counted \`mappedAdrs.length\` (708) instead of the engine's actual graph size. In Phase 2A.2, this was fixed in three ways: (1) \`DAGEngine\` now records duplicate IDs (with every file path involved) as a validation error and \`ndag validate\` fails on them rather than silently overwriting; (2) the corpus analyzer derives fallback IDs for generic filenames (\`README.md\`, \`index.md\`) from their parent directory name (e.g., \`keps/sig-api/1027-api-unions/README.md\` → \`1027-api-unions\`) and disambiguates any remaining collisions by appending the relative file path; and (3) \`Nodes\`, \`Edges\`, \`Isolated Nodes\`, and \`Edge Density\` are read directly from \`DAGEngine\`'s graph.

---

## 2. Benchmark Results & Extraction Quality

${tableHeader}
${tableRows}

*Column notes:*
- **Real Title %**: % of parsed files whose extracted title came from frontmatter, H1 heading, RFC metadata line, or \`kep.yaml\` (excludes filename slug and \`'Untitled ADR'\` fallbacks).
- **Title Source (FM / H1 / Meta / KEP / Slug)**: % breakdown by title source: YAML frontmatter (\`FM\`), first H1 heading (\`H1\`), RFC metadata line (\`Meta\`), \`kep.yaml\` (\`KEP\`), or filename slug (\`Slug\`).
- **Status Found %**: % of parsed files where \`statusSource\` is not \`'default'\` (i.e. extracted from frontmatter, \`## Status\` section, metadata line, or \`kep.yaml\`).
- **Status Source (FM / Sec / Line / KEP)**: % breakdown by status source: YAML frontmatter (\`FM\`), \`## Status\` section (\`Sec\`), metadata line (\`Line\`), or \`kep.yaml\` (\`KEP\`).
- **ID Source (FM / File / Gen)**: % of parsed files whose ID came from YAML frontmatter (\`FM\`), filename fallback (\`File\`), or random generation (\`Gen\`).
- **Duplicate IDs**: Count of parsed files whose initial ID collided with another file before relative-path disambiguation.
- **Unique IDs**: Count of distinct node IDs in \`DAGEngine\`'s graph after disambiguation.
- **Edges (Hard / Soft)**: Active intra-repo edges split into hard dependencies (frontmatter \`depends_on\` / \`supersedes\`, status \`Supersedes ADR-XXXX\`, or KEP \`replaces\` / \`superseded-by\`) and soft references (body markdown links, ID tokens, and KEP \`see-also\`).
- **Hard Cycles / Mutual Refs**: Hard cycles fail \`ndag validate\`; soft mutual references are informational only.
- **Checkout Time (cached)**: Time to verify/checkout the pinned commit SHA from the local \`.corpus/\` cache (50–60 ms reflects cached local checkouts, not fresh network clones).

### Extraction Quality Before/After Comparison (Phase 2C-2b)

| Repository | Real Title % (Before → After) | Status Found % (Before → After) | Hard Edges (Before → After) |
| :--- | :---: | :---: | :---: |
${extractionComparisonRows}

### Link Resolution & Before/After Comparison (Phase 2C-1.1)

| Repository | Resolved Links | Non-Decision | Outside-Scope | Ambiguous | Truly Broken Links | Edges (Before → After) | Broken Links (Before → After) |
| :--- |:---:|:---:|:---:|:---:|:---:|:---:|:---:|
${linkComparisonRows}

*Notes:*
- **Resolved Links**: Relative Markdown links and bare ID mentions resolved to a unique decision node in the same repository (creating soft edges).
- **Non-Decision**: Relative Markdown links whose target exists inside the analyzed folder (e.g., \`PROCESS.md\`, images, diagrams) but is not a decision node.
- **Outside-Scope**: Relative Markdown links whose target exists in the repository's full \`git ls-tree\` at the pinned commit, outside the analyzed decision folder.
- **Ambiguous**: Bare ID mentions (e.g., \`[ADR-020]\`) matching multiple decisions; no edge is created.
- **Truly Broken Links**: Targets absent from the full repository tree (plus unresolved hard/bare-ID references); external \`http(s)\` links are excluded.

### Lint Rules Breakdown (Phase 3)

| Repository | \`accepted-depends-on-deprecated\` | \`superseded-without-successor\` | \`broken-supersedes\` | \`orphan\` | Total Findings |
| :--- |:---:|:---:|:---:|:---:|:---:|
${lintRows}
${lintTotalRow}

*Notes:*
- Status-dependent rules (\`accepted-depends-on-deprecated\`, \`superseded-without-successor\`) skip nodes whose status is defaulted (no explicit \`status\`, \`stage\`, or \`state\` in frontmatter).
- Up to 5 concrete findings per rule (with file paths and reasons) are recorded in \`results/evidence.json\`.

---

## 3. Observed Metrics

${topFailureSections.length > 0 ? `### Parse Failures Observed\n\n${topFailureSections}\n` : '### Parse Failures Observed\n\nNo unhandled parse failures were recorded across the analyzed files.\n'}

### Graph Connectivity & Isolated Nodes
- Across the ${summary.totalReposAnalyzed} repositories, measured edge density ranges from **${minDensity}** to **${maxDensity}** edges per node, with **${totalIsolated}** of **${summary.totalNodes}** nodes having zero incoming and zero outgoing edges.

### Unresolved References (Broken Links)
- **${summary.totalBrokenLinks}** dependency targets could not be matched to any parsed node ID in the same repository. Samples (up to 10 per repository, with source file path and raw link text) are recorded in \`results/evidence.json\`.

### Hard Cycles vs. Soft Mutual References
- The DAG engine flagged **${summary.totalCyclesDetected}** repository(ies) with hard circular dependencies and **${summary.totalMutualReferences}** soft mutual reference pair(s) (see-also body links recorded in \`results/evidence.json\`).

---

## 4. Limitations

1. **Silent Parser Defaults:** \`parseADRContent()\` defaults missing \`status\` to \`'accepted'\` and missing \`title\` to \`'Untitled ADR'\`, and falls back to filename-derived IDs when frontmatter \`id\` is absent. Without separate extraction-quality metrics, \`Parsed OK\` alone overstates structured metadata coverage.
2. **Unvalidated Broken Links:** Broken links reflect raw parser/engine output and have not yet been manually verified as true positives vs. relative links to non-ADR files.
3. **Non-ADR Markdown Files:** Subfolders may contain index or template files (e.g., \`README.md\`, templates) that are included in \`Files Found\` and assigned fallback IDs.

---

## 5. Manual Validation

Review the raw evidence in \`results/evidence.json\` and check off each item once verified:

### Detected Cycles
${cycleValidationItems || '- [ ] No cycles detected'}

### Broken Link Samples
${brokenLinkValidationItems || '- [ ] No broken links detected'}

---

## 6. Evaluated and Excluded Repositories

| Repository | License | Status | Reason |
| :--- | :--- | :---: | :--- |
${droppedRows}

---

## 7. Licensing & Research Notice

${licenseNotice}
`;
}

export async function writeFindingsMarkdown(
  report: CorpusBenchmarkReport,
  outputPath?: string
): Promise<string> {
  const target = outputPath || path.resolve(process.cwd(), 'docs', 'FINDINGS.md');
  await fs.ensureDir(path.dirname(target));
  const content = generateFindingsMarkdown(report);
  await fs.writeFile(target, content, 'utf-8');
  return target;
}
