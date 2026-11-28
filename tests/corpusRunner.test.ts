import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeDecisionFiles,
  readDirectoryDecisionFiles,
  readDirectoryDecisionFilesWithExclusions,
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
    expect(outcome.extractionQuality.edgeSourceBreakdownSupported).toBe(true);
    expect(outcome.hardEdges).toBe(1);
    expect(outcome.softEdges).toBe(0);
    expect(outcome.mutualReferencesCount).toBe(0);

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

  it('extracts hard cycle evidence and separates soft mutual references', () => {
    const hardOutcome = analyzeDecisionFiles([
      {
        relativePath: '0001-a.md',
        content: '---\nid: ADR-0001\ntitle: A\nstatus: accepted\ndepends_on:\n  - ADR-0002\n---\n# A\n',
      },
      {
        relativePath: '0002-b.md',
        content: '---\nid: ADR-0002\ntitle: B\nstatus: proposed\ndepends_on:\n  - ADR-0001\n---\n# B\n',
      },
    ]);

    expect(hardOutcome.cyclesFound).toBe(true);
    expect(hardOutcome.evidence.cycles.length).toBe(1);
    expect(hardOutcome.evidence.cycles[0].edges.length).toBe(2);
    expect(hardOutcome.evidence.cycles[0].edges).toEqual(
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
          rawLinkText: 'frontmatter depends_on: ADR-0001',
        }),
      ])
    );

    const softOutcome = analyzeDecisionFiles([
      {
        relativePath: '0008-a.md',
        content: '---\nid: ADR-0008\ntitle: A\nstatus: accepted\n---\n# A\nSee [ADR-0013]\n',
      },
      {
        relativePath: '0013-b.md',
        content: '---\nid: ADR-0013\ntitle: B\nstatus: accepted\n---\n# B\nSee [ADR-0008]\n',
      },
    ]);

    expect(softOutcome.cyclesFound).toBe(false);
    expect(softOutcome.hardEdges).toBe(0);
    expect(softOutcome.softEdges).toBe(2);
    expect(softOutcome.mutualReferencesCount).toBe(1);
    expect(softOutcome.evidence.mutualReferences.length).toBe(1);
    expect(softOutcome.evidence.mutualReferences[0].pair).toEqual(['ADR-0008', 'ADR-0013']);
  });

  it('generates Markdown report with accurate table rows, matching column counts, and manual validation checkboxes', () => {
    const mockReport: CorpusBenchmarkReport = {
      timestamp: '2026-11-24T00:00:00.000Z',
      runnerVersion: '1.0.0-phase2a.2+2b',
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
        totalHardEdges: 1,
        totalSoftEdges: 0,
        totalBrokenLinks: 1,
        totalCyclesDetected: 0,
        totalMutualReferences: 0,
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
            edgeSourceBreakdownSupported: true,
          },
          duplicateIdsCount: 0,
          uniqueIdsCount: 4,
          nodes: 4,
          edges: 1,
          hardEdges: 1,
          softEdges: 0,
          edgeDensity: 0.25,
          isolatedNodes: 2,
          cyclesFound: false,
          mutualReferencesCount: 0,
          mutualReferences: [],
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
    expect(markdown).toContain('| [test-org/test-repo](https://github.com/test-org/test-repo.git) | `abc1234` | `madr` | MIT | 6 | 4 | 66.7% | 75% | 50% | 25% / 75% / 0% | 0 | 4 | 4 | 1 / 0 | 0.25 | 2 | None | 0 | 1 | 15ms | 50ms |');
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

  describe('Link classification metrics in corpus analyzer & reporter (Phase 2C-1.1)', () => {
    it('tracks outsideScopeLinks and ambiguousLinks in analyzeDecisionFiles and renders them in generateFindingsMarkdown', () => {
      const outcome = analyzeDecisionFiles(
        [
          {
            relativePath: 'docs/decisions/0010-first.md',
            content: '# First 10\n',
          },
          {
            relativePath: 'docs/decisions/sig-b/0010-second.md',
            content: '# Second 10\n',
          },
          {
            relativePath: 'docs/decisions/0020-consumer.md',
            content: '# Consumer\nSee [guide](../guides/setup.md) and [ADR-10] and [ADR-999].\n',
          },
        ],
        {
          repoFiles: [
            'docs/decisions/0010-first.md',
            'docs/decisions/sig-b/0010-second.md',
            'docs/decisions/0020-consumer.md',
            'docs/guides/setup.md',
          ],
          analyzedFolders: ['docs/decisions'],
        }
      );

      expect(outcome.outsideScopeLinks).toBe(1);
      expect(outcome.ambiguousLinks).toBe(1);
      expect(outcome.brokenLinks).toBe(1);

      const mockReport: CorpusBenchmarkReport = {
        timestamp: '2026-11-26T00:00:00.000Z',
        runnerVersion: '1.0.0-phase2c.1.1',
        licenseNotice: 'Test license notice',
        summary: {
          totalReposAnalyzed: 1,
          totalFilesFound: 3,
          totalFilesParsedOK: 3,
          averageParseRatePercent: 100,
          totalNodes: 3,
          totalEdges: 0,
          totalDuplicateIds: 1,
          totalUniqueIds: 3,
          totalHardEdges: 0,
          totalSoftEdges: 0,
          totalResolvedLinks: 0,
          totalNonDecisionLinks: 0,
          totalOutsideScopeLinks: 1,
          totalAmbiguousLinks: 1,
          totalExternalLinks: 0,
          totalBrokenLinks: 1,
          totalCyclesDetected: 0,
          totalMutualReferences: 0,
        },
        results: [
          {
            repo: 'org/repo',
            url: 'https://github.com/org/repo.git',
            format: 'madr',
            license: 'MIT',
            commitSha: '1234567890abcdef1234567890abcdef12345678',
            filesFound: 3,
            filesParsedOK: 3,
            parseRatePercent: 100,
            parseFailuresCount: 0,
            parseFailures: [],
            topFailureReasons: [],
            extractionQuality: {
              realTitleCount: 3,
              realTitlePercent: 100,
              statusFoundCount: 0,
              statusFoundPercent: 0,
              idFromFrontmatterCount: 0,
              idFromFrontmatterPercent: 0,
              idFromFilenameCount: 3,
              idFromFilenamePercent: 100,
              idGeneratedCount: 0,
              idGeneratedPercent: 0,
              edgeSourceBreakdownSupported: true,
            },
            duplicateIdsCount: 1,
            uniqueIdsCount: 3,
            nodes: 3,
            edges: 0,
            hardEdges: 0,
            softEdges: 0,
            edgeDensity: 0,
            isolatedNodes: 3,
            cyclesFound: false,
            mutualReferencesCount: 0,
            mutualReferences: [],
            resolvedLinks: 0,
            nonDecisionLinks: 0,
            outsideScopeLinks: 1,
            ambiguousLinks: 1,
            externalLinks: 0,
            brokenLinks: 1,
            before: { edges: 0, brokenLinks: 3 },
            missingDependencies: [{ adrId: 'ADR-0020', missingId: 'ADR-999' }],
            timing: { cloneMs: 10, analysisMs: 5, totalMs: 15 },
          },
        ],
        droppedRepositories: [],
      };

      const md = generateFindingsMarkdown(mockReport);
      expect(md).toContain('Outside-Scope');
      expect(md).toContain('Ambiguous');
      expect(md).toContain('| **org/repo** | 0 | 0 | 1 | 1 | 1 | 0 → 0 | 3 → 1 |');
    });

    it('filters non-decision files via include/exclude globs and records excludedFiles + Phase 2C-2a columns', async () => {
      const linkFixtureDir = path.resolve(__dirname, 'fixtures', 'link-resolution');
      const { files, excludedFiles } = await readDirectoryDecisionFilesWithExclusions(
        linkFixtureDir,
        ['docs/architecture'],
        {
          include: ['adr-*.md'],
          exclude: ['PROCESS.md', 'README.md'],
        }
      );

      expect(files.map((f) => f.relativePath).sort()).toEqual([
        'docs/architecture/adr-004-keys.md',
        'docs/architecture/adr-005-auth.md',
        'docs/architecture/adr-006-no-ext.md',
      ]);
      expect(excludedFiles.sort()).toEqual([
        'docs/architecture/PROCESS.md',
        'docs/architecture/README.md',
      ]);

      const md = generateFindingsMarkdown({
        timestamp: '2026-11-26T00:00:00.000Z',
        runnerVersion: '1.0.0-phase2c.2a',
        licenseNotice: 'Test notice',
        summary: {
          totalReposAnalyzed: 1,
          totalFilesFound: 5,
          totalExcludedFiles: 2,
          totalFilesParsedOK: 3,
          averageParseRatePercent: 100,
          totalNodes: 3,
          totalEdges: 0,
          totalDuplicateIds: 0,
          totalUniqueIds: 3,
          totalHardEdges: 0,
          totalSoftEdges: 0,
          totalResolvedLinks: 0,
          totalNonDecisionLinks: 0,
          totalOutsideScopeLinks: 0,
          totalAmbiguousLinks: 0,
          totalExternalLinks: 0,
          totalNotAFileLinks: 0,
          totalBrokenLinks: 0,
          totalCyclesDetected: 0,
          totalMutualReferences: 0,
        },
        results: [
          {
            repo: 'cosmos/cosmos-sdk',
            url: 'https://github.com/cosmos/cosmos-sdk.git',
            format: 'adr',
            license: 'Apache-2.0',
            commitSha: '06a015222f13fe7b41bc3969504da7dee875ae5c',
            filesFound: 5,
            excludedCount: 2,
            filesParsedOK: 3,
            parseRatePercent: 100,
            parseFailuresCount: 0,
            parseFailures: [],
            topFailureReasons: [],
            extractionQuality: {
              realTitleCount: 3,
              realTitlePercent: 100,
              statusFoundCount: 0,
              statusFoundPercent: 0,
              idFromFrontmatterCount: 0,
              idFromFrontmatterPercent: 0,
              idFromFilenameCount: 3,
              idFromFilenamePercent: 100,
              idGeneratedCount: 0,
              idGeneratedPercent: 0,
              edgeSourceBreakdownSupported: true,
            },
            duplicateIdsCount: 0,
            uniqueIdsCount: 3,
            nodes: 3,
            edges: 0,
            hardEdges: 0,
            softEdges: 0,
            edgeDensity: 0,
            isolatedNodes: 3,
            cyclesFound: false,
            mutualReferencesCount: 0,
            mutualReferences: [],
            resolvedLinks: 0,
            nonDecisionLinks: 0,
            outsideScopeLinks: 0,
            ambiguousLinks: 0,
            externalLinks: 0,
            notAFileLinks: 0,
            brokenLinks: 0,
            before: { nodes: 5, edges: 0, brokenLinks: 1 },
            missingDependencies: [],
            timing: { cloneMs: 10, analysisMs: 5, totalMs: 15 },
          },
        ],
        droppedRepositories: [],
      });

      expect(md).toContain('Excluded');
      expect(md).toContain('Decision Nodes');
      expect(md).toContain('Nodes (Before → After)');
      expect(md).toContain('5 → 3');
      expect(md).toContain('1 → 0');
    });
  });
});
