import { describe, it, expect } from 'vitest';
import { parseBatchADRs } from '../src/core/adrParser.js';
import { validateAndComputeDAG } from '../src/core/dagEngine.js';
import { lintArchitecture, type LintConfig } from '../src/core/linter.js';

function buildAndLint(
  files: { name: string; content: string }[],
  config?: LintConfig
) {
  const parsed = parseBatchADRs(
    files.map((f) => ({ name: f.name, filePath: f.name, content: f.content }))
  );
  const { engine, mappedAdrs } = validateAndComputeDAG(parsed);
  return lintArchitecture(mappedAdrs, engine, config);
}

describe('ADR Lint Rules Engine', () => {
  it('flags accepted-depends-on-deprecated when an accepted ADR hard-depends on a deprecated or superseded ADR', () => {
    const result = buildAndLint([
      {
        name: '0001-old.md',
        content: `---\nid: ADR-0001\ntitle: Old\nstatus: deprecated\n---\n# Old`,
      },
      {
        name: '0002-new.md',
        content: `---\nid: ADR-0002\ntitle: New\nstatus: accepted\ndepends_on:\n  - ADR-0001\n---\n# New`,
      },
    ]);

    const finding = result.findings.find(
      (f) => f.ruleId === 'accepted-depends-on-deprecated'
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('error');
    expect(finding?.files).toContain('0002-new.md');
    expect(finding?.files).toContain('0001-old.md');
    expect(result.hasErrors).toBe(true);
  });

  it('skips accepted-depends-on-deprecated when dependent status is default (not explicitly authored)', () => {
    const result = buildAndLint([
      {
        name: '0001-old.md',
        content: `---\nid: ADR-0001\ntitle: Old\nstatus: deprecated\n---\n# Old`,
      },
      {
        name: '0002-no-status.md',
        content: `---\nid: ADR-0002\ntitle: No Status\ndepends_on:\n  - ADR-0001\n---\n# No Status`,
      },
    ]);

    const finding = result.findings.find(
      (f) => f.ruleId === 'accepted-depends-on-deprecated'
    );
    expect(finding).toBeUndefined();
  });

  it('flags superseded-without-successor when no decision supersedes it or declares superseded-by', () => {
    const result = buildAndLint([
      {
        name: '0001-legacy.md',
        content: `---\nid: ADR-0001\ntitle: Legacy\nstatus: superseded\n---\n# Legacy`,
      },
    ]);

    const finding = result.findings.find(
      (f) => f.ruleId === 'superseded-without-successor'
    );
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warn');
    expect(finding?.files).toEqual(['0001-legacy.md']);
    expect(result.hasErrors).toBe(false);
  });

  it('does not flag superseded-without-successor when another ADR supersedes it or it declares superseded-by', () => {
    const result = buildAndLint([
      {
        name: '0001-legacy.md',
        content: `---\nid: ADR-0001\ntitle: Legacy\nstatus: superseded\n---\n# Legacy`,
      },
      {
        name: '0002-successor.md',
        content: `---\nid: ADR-0002\ntitle: Successor\nstatus: accepted\nsupersedes:\n  - ADR-0001\n---\n# Successor`,
      },
      {
        name: '0003-legacy-by.md',
        content: `---\nid: ADR-0003\ntitle: Legacy By\nstatus: superseded\nsuperseded-by: ADR-0002\n---\n# Legacy By`,
      },
    ]);

    const findings = result.findings.filter(
      (f) => f.ruleId === 'superseded-without-successor'
    );
    expect(findings).toHaveLength(0);
  });

  it('flags broken-supersedes when a supersedes or superseded-by target does not exist', () => {
    const result = buildAndLint([
      {
        name: '0001-a.md',
        content: `---\nid: ADR-0001\ntitle: A\nstatus: accepted\nsupersedes:\n  - ADR-9999\n---\n# A`,
      },
      {
        name: '0002-b.md',
        content: `---\nid: ADR-0002\ntitle: B\nstatus: superseded\nsuperseded-by: ADR-8888\n---\n# B`,
      },
    ]);

    const findings = result.findings.filter(
      (f) => f.ruleId === 'broken-supersedes'
    );
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === 'error')).toBe(true);
  });

  it('flags orphan as info when a decision has no hard or soft edges at all', () => {
    const result = buildAndLint([
      {
        name: '0001-alone.md',
        content: `---\nid: ADR-0001\ntitle: Alone\nstatus: accepted\n---\n# Alone`,
      },
      {
        name: '0002-linked.md',
        content: `---\nid: ADR-0002\ntitle: Linked\nstatus: accepted\n---\nSee [ADR-0003]`,
      },
      {
        name: '0003-target.md',
        content: `---\nid: ADR-0003\ntitle: Target\nstatus: accepted\n---\n# Target`,
      },
    ]);

    const orphans = result.findings.filter((f) => f.ruleId === 'orphan');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].severity).toBe('info');
    expect(orphans[0].files).toEqual(['0001-alone.md']);
    expect(result.hasErrors).toBe(false);
  });

  it('supports rule enable/disable and severity overrides via config, keeping orphan info-only', () => {
    const result = buildAndLint(
      [
        {
          name: '0001-legacy.md',
          content: `---\nid: ADR-0001\ntitle: Legacy\nstatus: superseded\n---\n# Legacy`,
        },
        {
          name: '0002-alone.md',
          content: `---\nid: ADR-0002\ntitle: Alone\nstatus: accepted\n---\n# Alone`,
        },
      ],
      {
        rules: {
          'superseded-without-successor': 'error',
          orphan: 'error' as any, // orphan must remain info and never fail CI
        },
      }
    );

    const sup = result.findings.find(
      (f) => f.ruleId === 'superseded-without-successor'
    );
    const orp = result.findings.find((f) => f.ruleId === 'orphan');
    expect(sup?.severity).toBe('error');
    expect(orp?.severity).toBe('info');

    const disabled = buildAndLint(
      [
        {
          name: '0001-legacy.md',
          content: `---\nid: ADR-0001\ntitle: Legacy\nstatus: superseded\n---\n# Legacy`,
        },
      ],
      {
        rules: {
          'superseded-without-successor': 'off',
          orphan: false,
        },
      }
    );
    expect(disabled.findings).toHaveLength(0);
  });
});
