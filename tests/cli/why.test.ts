import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const cliEntry = path.resolve(process.cwd(), 'src/cli/index.ts');

function runWhyCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync('npx', ['tsx', cliEntry, 'why', ...args], {
      cwd,
      encoding: 'utf-8',
      shell: true,
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
        statusSource: 'explicit',
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
});
