import { describe, it, expect } from 'vitest';
import { parseBatchADRs } from '../src/core/adrParser.js';
import { validateAndComputeDAG } from '../src/core/dagEngine.js';
import { getGoverningDecisionsForFiles, normalizeRepoPath } from '../src/core/affects.js';

function buildGraph(docs: Array<{ name: string; content: string }>) {
  const parsed = parseBatchADRs(docs);
  const { engine, mappedAdrs } = validateAndComputeDAG(parsed);
  return { engine, mappedAdrs };
}

describe('normalizeRepoPath', () => {
  it('normalizes Windows backslashes and leading ./ or /', () => {
    expect(normalizeRepoPath('src\\auth\\login.ts')).toBe('src/auth/login.ts');
    expect(normalizeRepoPath('./src/auth/login.ts')).toBe('src/auth/login.ts');
    expect(normalizeRepoPath('/src/auth/login.ts')).toBe('src/auth/login.ts');
  });
});

describe('getGoverningDecisionsForFiles (Phase 4)', () => {
  it('matches single and multiple globs, overlapping decisions, and no-match files', () => {
    const { engine, mappedAdrs } = buildGraph([
      {
        name: '0001-core.md',
        content: `---
id: ADR-0001
title: Core Architecture
status: accepted
affects:
  - "src/core/**"
---
# Core
`,
      },
      {
        name: '0002-auth.md',
        content: `---
id: ADR-0002
title: Auth Boundary
status: accepted
depends_on:
  - ADR-0001
affects:
  - "src/auth/**"
  - "src/core/auth*.ts"
---
# Auth
`,
      },
    ]);

    const results = getGoverningDecisionsForFiles(
      ['src/core/authMiddleware.ts', 'src/auth/login.ts', 'README.md'],
      mappedAdrs,
      engine
    );

    expect(results).toHaveLength(3);

    // Overlapping decisions on src/core/authMiddleware.ts
    expect(results[0].file).toBe('src/core/authMiddleware.ts');
    expect(results[0].decisions.map((d) => d.id)).toEqual(['ADR-0001', 'ADR-0002']);
    expect(results[0].decisions[0]).toMatchObject({
      id: 'ADR-0001',
      title: 'Core Architecture',
      status: 'accepted',
      statusSource: 'explicit',
      matchingGlob: 'src/core/**',
      isDeprecatedOrSuperseded: false,
      ancestors: [],
    });
    expect(results[0].decisions[1]).toMatchObject({
      id: 'ADR-0002',
      title: 'Auth Boundary',
      status: 'accepted',
      statusSource: 'explicit',
      matchingGlob: 'src/core/auth*.ts',
      isDeprecatedOrSuperseded: false,
      ancestors: [
        {
          id: 'ADR-0001',
          title: 'Core Architecture',
          status: 'accepted',
          statusSource: 'explicit',
        },
      ],
    });

    // Single match on src/auth/login.ts
    expect(results[1].decisions.map((d) => d.id)).toEqual(['ADR-0002']);
    expect(results[1].decisions[0].matchingGlob).toBe('src/auth/**');

    // No match on README.md
    expect(results[2].decisions).toEqual([]);
  });

  it('handles Windows backslash paths, deep paths, and dotfiles', () => {
    const { engine, mappedAdrs } = buildGraph([
      {
        name: '0001-ci.md',
        content: `---
id: ADR-0001
title: CI & Deep Modules
status: accepted
affects:
  - ".github/workflows/*.yml"
  - "services/**/domain/*.ts"
---
`,
      },
    ]);

    const results = getGoverningDecisionsForFiles(
      [
        '.github\\workflows\\ci.yml',
        'services\\billing\\v2\\sub\\domain\\invoice.ts',
      ],
      mappedAdrs,
      engine
    );

    expect(results[0].file).toBe('.github/workflows/ci.yml');
    expect(results[0].decisions).toHaveLength(1);
    expect(results[0].decisions[0].matchingGlob).toBe('.github/workflows/*.yml');

    expect(results[1].file).toBe('services/billing/v2/sub/domain/invoice.ts');
    expect(results[1].decisions).toHaveLength(1);
    expect(results[1].decisions[0].matchingGlob).toBe('services/**/domain/*.ts');
  });

  it('uses case-sensitive POSIX glob matching for cross-platform determinism', () => {
    const { engine, mappedAdrs } = buildGraph([
      {
        name: '0001-auth.md',
        content: `---
id: ADR-0001
title: Auth
status: accepted
affects:
  - "src/auth/**"
---
`,
      },
    ]);

    const results = getGoverningDecisionsForFiles(
      ['src/auth/login.ts', 'src/Auth/Login.ts'],
      mappedAdrs,
      engine
    );

    expect(results[0].decisions).toHaveLength(1);
    expect(results[1].decisions).toHaveLength(0);
  });

  it('flags deprecated and superseded governing decisions and resolves multi-hop hard ancestors', () => {
    const { engine, mappedAdrs } = buildGraph([
      {
        name: '0001-root.md',
        content: `---
id: ADR-0001
title: Root Platform
---
`,
      },
      {
        name: '0002-mid.md',
        content: `---
id: ADR-0002
title: Mid Layer
status: accepted
depends_on:
  - ADR-0001
---
`,
      },
      {
        name: '0003-legacy.md',
        content: `---
id: ADR-0003
title: Legacy Token Auth
status: deprecated
depends_on:
  - ADR-0002
affects:
  - "src/legacy/**"
---
See [ADR-0001] for soft ref.
`,
      },
      {
        name: '0004-old-pay.md',
        content: `---
id: ADR-0004
title: Old Pay SDK
status: superseded
affects:
  - "src/pay/**"
---
`,
      },
    ]);

    const results = getGoverningDecisionsForFiles(
      ['src/legacy/token.ts', 'src/pay/client.ts'],
      mappedAdrs,
      engine
    );

    expect(results[0].decisions[0]).toMatchObject({
      id: 'ADR-0003',
      status: 'deprecated',
      statusSource: 'explicit',
      isDeprecatedOrSuperseded: true,
    });
    expect(results[0].decisions[0].ancestors).toEqual([
      {
        id: 'ADR-0002',
        title: 'Mid Layer',
        status: 'accepted',
        statusSource: 'explicit',
      },
      {
        id: 'ADR-0001',
        title: 'Root Platform',
        status: 'accepted',
        statusSource: 'default',
      },
    ]);

    expect(results[1].decisions[0]).toMatchObject({
      id: 'ADR-0004',
      status: 'superseded',
      isDeprecatedOrSuperseded: true,
    });
  });
});
