import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const cliEntry = path.resolve(process.cwd(), 'dist/cli.js');

function runWhyCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync(process.execPath, [cliEntry, 'why', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout };
  } catch (err: any) {
    return {
      status: err.status ?? 1,
      stdout: (err.stdout?.toString('utf-8') || '') + (err.stderr?.toString('utf-8') || ''),
    };
  }
}

describe('CLI ndag why', () => {
  it('outputs governing decisions, ancestors, and deprecated flags in JSON and human format with exit 0', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-why-test-'));
    const adrDir = path.join(tmpDir, 'docs', 'adr');
    await fs.ensureDir(adrDir);

    try {
      await fs.writeFile(
        path.join(adrDir, '0001-base.md'),
        `---
id: ADR-0001
title: Core Engine
status: accepted
affects:
  - "src/core/**"
---
# Core Engine
`
      );
      await fs.writeFile(
        path.join(adrDir, '0002-legacy.md'),
        `---
id: ADR-0002
title: Legacy Auth
status: deprecated
depends_on:
  - ADR-0001
affects:
  - "src/auth/*.ts"
---
# Legacy Auth
`
      );

      // 1. JSON output with explicit positional dir
      const jsonRun = runWhyCli(['src/auth/login.ts', 'README.md', 'docs/adr', '--json'], tmpDir);
      expect(jsonRun.status).toBe(0);
      const parsed = JSON.parse(jsonRun.stdout);
      expect(parsed.results).toHaveLength(2);
      expect(parsed.results[0].file).toBe('src/auth/login.ts');
      expect(parsed.results[0].decisions).toHaveLength(1);
      expect(parsed.results[0].decisions[0]).toMatchObject({
        id: 'ADR-0002',
        title: 'Legacy Auth',
        status: 'deprecated',
        statusSource: 'frontmatter',
        matchingGlob: 'src/auth/*.ts',
        isDeprecatedOrSuperseded: true,
      });
      expect(parsed.results[0].decisions[0].ancestors.map((a: any) => a.id)).toEqual(['ADR-0001']);
      expect(parsed.results[1]).toEqual({ file: 'README.md', decisions: [] });

      // 2. Human output with default ./docs/adr dir
      const humanRun = runWhyCli(['src/auth/login.ts', 'README.md'], tmpDir);
      expect(humanRun.status).toBe(0);
      expect(humanRun.stdout).toContain('ADR-0002');
      expect(humanRun.stdout).toContain('Legacy Auth');
      expect(humanRun.stdout).toContain('deprecated');
      expect(humanRun.stdout).toContain('ADR-0001');
      expect(humanRun.stdout).toContain('No governing decisions');
    } finally {
      await fs.remove(tmpDir);
    }
  }, 30000);

  it('supports --root override and resolves repo root from ADR dir when run from outside cwd', async () => {
    const baseTmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-why-root-'));
    const repoDir = path.join(baseTmp, 'repo');
    const adrDir = path.join(repoDir, 'docs', 'adr');
    const outsideDir = path.join(baseTmp, 'outside');

    try {
      await fs.ensureDir(path.join(repoDir, '.git'));
      await fs.ensureDir(path.join(repoDir, 'src', 'core'));
      await fs.ensureDir(adrDir);
      await fs.ensureDir(outsideDir);

      const targetFile = path.join(repoDir, 'src', 'core', 'engine.ts');
      await fs.writeFile(targetFile, 'export const x = 1;\n');
      await fs.writeFile(
        path.join(adrDir, '0001-core.md'),
        `---\nid: ADR-0001\ntitle: Core Engine\nstatus: accepted\naffects:\n  - "src/core/**"\n---\n# Core Engine\n`
      );

      const autoRootRun = runWhyCli([targetFile, adrDir, '--json'], outsideDir);
      expect(autoRootRun.status).toBe(0);
      const autoJson = JSON.parse(autoRootRun.stdout);
      expect(autoJson.results[0].file).toBe('src/core/engine.ts');
      expect(autoJson.results[0].decisions).toHaveLength(1);
      expect(autoJson.results[0].decisions[0].id).toBe('ADR-0001');

      const explicitRootRun = runWhyCli(
        [targetFile, '--dir', adrDir, '--root', repoDir, '--json'],
        outsideDir
      );
      expect(explicitRootRun.status).toBe(0);
      const explicitJson = JSON.parse(explicitRootRun.stdout);
      expect(explicitJson.results[0].file).toBe('src/core/engine.ts');
      expect(explicitJson.results[0].decisions[0].id).toBe('ADR-0001');
    } finally {
      await fs.remove(baseTmp);
    }
  }, 30000);
});
