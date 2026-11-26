import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import { parseBatchADRs } from '../src/core/adrParser.js';
import { validateAndComputeDAG } from '../src/core/dagEngine.js';

const FIXTURE_ROOT = path.resolve(process.cwd(), 'tests/fixtures/link-resolution');

function loadFixtureFiles(subDir: string, excludeNames: string[] = []) {
  const baseDir = path.join(FIXTURE_ROOT, subDir);
  const results: Array<{ name: string; filePath: string; content: string }> = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.md') && !excludeNames.includes(entry.name)) {
        results.push({
          name: entry.name,
          filePath: path.relative(FIXTURE_ROOT, full).replace(/\\/g, '/'),
          content: fs.readFileSync(full, 'utf-8'),
        });
      }
    }
  }

  walk(baseDir);
  return results;
}

describe('Path-based link resolution and classification (Phase 2C-1)', () => {
  it('resolves README parent-dir IDs, ./adr-004-x.md links, anchors, queries, case differences, non-decision, external, and broken links', () => {
    // Load docs/architecture decision files, excluding PROCESS.md from decision nodes
    // while passing baseDir: FIXTURE_ROOT so PROCESS.md is recognized on disk as non-decision.
    const files = loadFixtureFiles('docs/architecture', ['PROCESS.md']);
    const parsed = parseBatchADRs(files, { baseDir: FIXTURE_ROOT });

    const readme = parsed.find((p) => p.filePath === 'docs/architecture/README.md');
    expect(readme).toBeDefined();
    expect(readme!.frontmatter.id).toBe('architecture');

    const links = readme!.links || [];
    const byRaw = new Map(links.map((l) => [l.rawLinkText, l]));

    expect(byRaw.get('(https://example.com/spec)')?.classification).toBe('external');
    expect(byRaw.get('(./PROCESS.md)')?.classification).toBe('non-decision');
    expect(byRaw.get('(./adr-004-keys.md)')).toMatchObject({
      classification: 'resolved',
      resolvedId: 'adr-004-keys',
    });
    expect(byRaw.get('(./ADR-005-AUTH.MD#decision)')).toMatchObject({
      classification: 'resolved',
      resolvedId: 'adr-005-auth',
    });
    expect(byRaw.get('(./adr-006-no-ext?tab=summary#top)')).toMatchObject({
      classification: 'resolved',
      resolvedId: 'adr-006-no-ext',
    });
    expect(byRaw.get('(./adr-999-missing.md)')?.classification).toBe('broken');

    // Body links must stay soft edges, and only broken links appear in missingSoftReferences
    const softTargets = (readme!.edges || [])
      .filter((e) => e.kind === 'soft')
      .map((e) => e.targetId);
    expect(softTargets).toContain('adr-004-keys');
    expect(softTargets).toContain('adr-005-auth');
    expect(softTargets).toContain('adr-006-no-ext');
    expect(softTargets).not.toContain('ADR-adr-004-keys');
    expect(softTargets).not.toContain('ADR-PROCESS');

    const { validationResult, engine } = validateAndComputeDAG(parsed);
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.missingSoftReferences).toEqual([
      { adrId: 'architecture', missingId: 'docs/architecture/adr-999-missing.md' },
    ]);
    expect(engine.getDirectDependencies('architecture')).toEqual([]);
    expect(engine.getSoftDependents('adr-004-keys')).toEqual(['architecture']);
  });

  it('resolves KEP-style folder layout where every decision is README.md in its own directory', () => {
    const files = loadFixtureFiles('keps');
    const parsed = parseBatchADRs(files, { baseDir: FIXTURE_ROOT });

    expect(parsed.map((p) => p.frontmatter.id).sort()).toEqual([
      '1027-api-unions',
      '2001-node-feature',
    ]);

    const nodeFeature = parsed.find((p) => p.frontmatter.id === '2001-node-feature');
    expect(nodeFeature).toBeDefined();
    expect(nodeFeature!.links).toEqual([
      expect.objectContaining({
        classification: 'resolved',
        resolvedId: '1027-api-unions',
        rawLinkText: '(../../sig-api/1027-api-unions/README.md#motivation)',
      }),
    ]);

    const { validationResult, engine } = validateAndComputeDAG(parsed);
    expect(validationResult.isValid).toBe(true);
    expect(validationResult.missingSoftReferences).toEqual([]);
    expect(engine.getSoftDependents('1027-api-unions')).toEqual(['2001-node-feature']);
  });

  it('classifies targets in repoFiles outside analyzedFolders as outside-scope and only truly absent targets as broken', () => {
    // Simulate sparse-checkout: only docs-outside-scope/decisions is analyzed, while repoFiles has the full git tree
    const files = loadFixtureFiles('docs-outside-scope/decisions', ['PROCESS.md']);
    const repoFiles = [
      'docs-outside-scope/decisions/adr-007-outside-scope.md',
      'docs-outside-scope/decisions/PROCESS.md',
      'docs-outside-scope/code-howtos/storage.md',
    ];

    const parsed = parseBatchADRs(files, {
      repoFiles,
      analyzedFolders: ['docs-outside-scope/decisions'],
    });

    const adr007 = parsed.find((p) => p.frontmatter.id === 'adr-007-outside-scope');
    expect(adr007).toBeDefined();

    const byRaw = new Map((adr007!.links || []).map((l) => [l.rawLinkText, l]));
    expect(byRaw.get('(../code-howtos/storage.md)')?.classification).toBe('outside-scope');
    expect(byRaw.get('(./PROCESS.md)')?.classification).toBe('non-decision');
    expect(byRaw.get('(../code-howtos/does-not-exist.md)')?.classification).toBe('broken');

    // Outside-scope and non-decision links must not create edges or broken references
    const { validationResult } = validateAndComputeDAG(parsed);
    expect(validationResult.missingSoftReferences).toEqual([
      { adrId: 'adr-007-outside-scope', missingId: 'docs-outside-scope/code-howtos/does-not-exist.md' },
    ]);
  });
});
