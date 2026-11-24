import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeDecisionFiles,
  readDirectoryDecisionFiles,
  aggregateFailureReasons,
  deriveFallbackId,
} from '../scripts/corpus/analyzer.js';
import { generateFindingsMarkdown } from '../scripts/corpus/reporter.js';
import type { CorpusBenchmarkReport } from '../scripts/corpus/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, 'fixtures', 'corpus-fixture');

describe('Corpus Runner & Analyzer Error Handling', () => {
  it('reads directory decision files including invalid/empty ones without crashing', async () => {
    const files = await readDirectoryDecisionFiles(fixtureDir, ['.']);
    expect(files.length).toBe(6);
    expect(files.some((f) => f.relativePath.includes('0001-base.md'))).toBe(true);
    expect(files.some((f) => f.relativePath.includes('0004-empty.md'))).toBe(true);
  });

  it('handles per-file parse failures gracefully, records reasons, and computes graph over valid files', async () => {
    const files = await readDirectoryDecisionFiles(fixtureDir, ['.']);
    const outcome = analyzeDecisionFiles(files);

    // Total 6 files found
    expect(outcome.filesFound).toBe(6);

    // 4 files valid: 0001, 0002, 0003, 0006
    expect(outcome.filesParsedOK).toBe(4);

    // 2 files failed: 0004 (empty), 0005 (whitespace)
    expect(outcome.parseFailuresCount).toBe(2);
    expect(outcome.parseFailures.length).toBe(2);
    expect(outcome.topFailureReasons.length).toBeGreaterThan(0);
    expect(outcome.topFailureReasons[0].reason).toContain('empty or contains only whitespace');

    // Graph metrics
    expect(outcome.nodes).toBe(4);
    // ADR-0002 -> ADR-0001 is 1 valid edge
    expect(outcome.edges).toBe(1);
    expect(outcome.edgeDensity).toBe(0.25);

    // ADR-0003 has broken dependency to ADR-9999
    expect(outcome.brokenLinks).toBe(1);
    expect(outcome.missingDependencies).toEqual([
      { adrId: 'ADR-0003', missingId: 'ADR-9999' },
    ]);

    // Isolated nodes: ADR-0006 has no dependencies and no dependents = 1
    expect(outcome.isolatedNodes).toBe(1);

    // No cycles in fixture
    expect(outcome.cyclesFound).toBe(false);

    // Extraction quality metrics
    expect(outcome.extractionQuality.realTitleCount).toBe(4);
    expect(outcome.extractionQuality.realTitlePercent).toBe(100);
    expect(outcome.extractionQuality.edgeSourceBreakdownSupported).toBe(false);

    // Evidence for broken links
    expect(outcome.evidence.cycles).toEqual([]);
    expect(outcome.evidence.brokenLinks.length).toBe(1);
    expect(outcome.evidence.brokenLinks[0]).toMatchObject({
      sourceId: 'ADR-0003',
      sourceFile: '0003-broken-dep.md',
      missingId: 'ADR-9999',
    });
    expect(outcome.evidence.brokenLinks[0].rawLinkText).toContain('ADR-9999');
  });

  it('aggregates failure reasons correctly and sorts by frequency', () => {
    const reasons = aggregateFailureReasons([
      { file: 'a.md', reason: 'YAML parse error\nLine 2' },
      { file: 'b.md', reason: 'YAML parse error\nLine 5' },
      { file: 'c.md', reason: 'Empty content' },
    ]);

    expect(reasons).toEqual([
      { reason: 'YAML parse error', count: 2 },
      { reason: 'Empty content', count: 1 },
    ]);
  });

  it('extracts cycle evidence with exact file paths and raw link text', () => {
    const outcome = analyzeDecisionFiles([
      {
        relativePath: '0001-a.md',
        content: '---\nid: ADR-0001\ntitle: A\nstatus: accepted\ndepends_on:\n  - ADR-0002\n---\n# A\n',
      },
      {
        relativePath: '0002-b.md',
        content: '---\nid: ADR-0002\ntitle: B\nstatus: proposed\n---\n# B\nSee [ADR-0001]\n',
      },
    ]);

    expect(outcome.cyclesFound).toBe(true);
    expect(outcome.evidence.cycles.length).toBe(1);
    expect(outcome.evidence.cycles[0].edges.length).toBe(2);
    expect(outcome.evidence.cycles[0].edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependentId: 'ADR-0001',
          dependentFile: '0001-a.md',
          dependencyId: 'ADR-0002',
          dependencyFile: '0002-b.md',
          rawLinkText: 'frontmatter depends_on: ADR-0002',
        }),
        expect.objectContaining({
          dependentId: 'ADR-0002',
          dependentFile: '0002-b.md',
          dependencyId: 'ADR-0001',
          dependencyFile: '0001-a.md',
          rawLinkText: '[ADR-0001]',
        }),
      ])
    );
  });

  it('generates Markdown report with accurate table rows, matching column counts, and manual validation checkboxes', () => {
    const mockReport: CorpusBenchmarkReport = {
      timestamp: '2026-11-24T00:00:00.000Z',
      runnerVersion: '1.0.0-phase2a.1',
      licenseNotice: 'License notice for benchmark test',
      summary: {
        totalReposAnalyzed: 1,
        totalFilesFound: 6,
        totalFilesParsedOK: 4,
        averageParseRatePercent: 66.7,
        totalNodes: 4,
        totalEdges: 1,
        totalDuplicateIds: 0,
        totalUniqueIds: 4,
        totalBrokenLinks: 1,
        totalCyclesDetected: 0,
      },
      results: [
        {
          repo: 'test-org/test-repo',
          url: 'https://github.com/test-org/test-repo.git',
          format: 'madr',
          license: 'MIT',
          commitSha: 'abc1234567890abcdef1234567890abcdef12345',
          filesFound: 6,
          filesParsedOK: 4,
          parseRatePercent: 66.7,
          parseFailuresCount: 2,
          parseFailures: [
            { file: '0004-empty.md', reason: 'File content is empty or contains only whitespace' },
          ],
          topFailureReasons: [
            { reason: 'File content is empty or contains only whitespace', count: 2 },
          ],
          extractionQuality: {
            realTitleCount: 3,
            realTitlePercent: 75,
            statusFoundCount: 2,
            statusFoundPercent: 50,
            idFromFrontmatterCount: 1,
            idFromFrontmatterPercent: 25,
            idFromFilenameCount: 3,
            idFromFilenamePercent: 75,
            idGeneratedCount: 0,
            idGeneratedPercent: 0,
            edgeSourceBreakdownSupported: false,
          },
          duplicateIdsCount: 0,
          uniqueIdsCount: 4,
          nodes: 4,
          edges: 1,
          edgeDensity: 0.25,
          isolatedNodes: 2,
          cyclesFound: false,
          brokenLinks: 1,
          missingDependencies: [{ adrId: 'ADR-0003', missingId: 'ADR-9999' }],
          timing: { cloneMs: 50, analysisMs: 15, totalMs: 65 },
        },
      ],
      droppedRepositories: [
        {
          name: 'python/peps',
          url: 'https://github.com/python/peps.git',
          license: 'CC0',
          reason: 'Authored in .rst format',
        },
      ],
    };

    const markdown = generateFindingsMarkdown(mockReport);
    expect(markdown).toContain('| [test-org/test-repo](https://github.com/test-org/test-repo.git) | `abc1234` | `madr` | MIT | 6 | 4 | 66.7% | 75% | 50% | 25% / 75% / 0% | 0 | 4 | 4 | 1 | 0.25 | 2 | None | 1 | 15ms | 50ms |');
    expect(markdown).toContain('Duplicate IDs');
    expect(markdown).toContain('Unique IDs');
    expect(markdown).toContain('Checkout Time (cached)');
    expect(markdown).not.toContain('| Clone Time |');
    expect(markdown).toContain('Data Quality');
    expect(markdown).toContain('Total Decision Files Found:** 6');
    expect(markdown).toContain('Parsed OK:** 4 (66.7%)');
    expect(markdown).toContain('Definition — "Parsed OK":');
    expect(markdown).toContain('## 5. Manual Validation');
    expect(markdown).toContain('- [ ] **test-org/test-repo**');
    expect(markdown).toContain('python/peps');

    // Verify benchmark table header, separator, and data row column counts match
    const tableLines = markdown
      .split('\n')
      .filter(
        (l) =>
          l.startsWith('| Repository | Commit |') ||
          l.startsWith('| :--- | :---: |') ||
          l.startsWith('| [test-org/test-repo]')
      );
    expect(tableLines.length).toBe(3);
    const colCounts = tableLines.map((l) => l.split('|').length);
    expect(colCounts[0]).toBe(colCounts[1]);
    expect(colCounts[1]).toBe(colCounts[2]);
  });

  describe('Fallback ID derivation & collision disambiguation', () => {
    it('derives fallback ID from parent directory name for generic filenames README.md and index.md', () => {
      expect(deriveFallbackId('keps/sig-api/1027-api-unions/README.md')).toBe('1027-api-unions');
      expect(deriveFallbackId('docs/architecture/index.md')).toBe('architecture');
      expect(deriveFallbackId('README.md')).toBe('README');
      expect(deriveFallbackId('0001-base.md')).toBe('ADR-0001');
    });

    it('keeps distinct parent-dir READMEs as distinct nodes without collision', () => {
      const outcome = analyzeDecisionFiles([
        {
          relativePath: 'keps/sig-api/1027-api-unions/README.md',
          content: '# API Unions\n',
        },
        {
          relativePath: 'keps/sig-node/2001-node-feature/README.md',
          content: '# Node Feature\n',
        },
      ]);

      expect(outcome.filesParsedOK).toBe(2);
      expect(outcome.nodes).toBe(2);
      expect(outcome.duplicateIdsCount).toBe(0);
      expect(outcome.uniqueIdsCount).toBe(2);
    });

    it('disambiguates remaining ID collisions by appending relative path and counts colliding files', () => {
      const outcome = analyzeDecisionFiles([
        {
          relativePath: 'sig-a/1027-shared/README.md',
          content: '# First\n',
        },
        {
          relativePath: 'sig-b/1027-shared/README.md',
          content: '# Second\n',
        },
        {
          relativePath: 'docs/unique.md',
          content: '---\nid: UNIQUE-1\ntitle: Unique\n---\n# Unique\n',
        },
      ]);

      expect(outcome.filesParsedOK).toBe(3);
      expect(outcome.nodes).toBe(3);
      expect(outcome.duplicateIdsCount).toBe(2);
      expect(outcome.uniqueIdsCount).toBe(3);
    });
  });
});
