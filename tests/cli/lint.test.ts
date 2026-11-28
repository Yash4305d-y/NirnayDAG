import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const cliEntry = path.resolve(process.cwd(), 'dist/cli.js');

function runLintCli(args: string[], cwd: string) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [cliEntry, 'lint', ...args],
      {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    return { status: 0, stdout };
  } catch (err: any) {
    return {
      status: err.status ?? 1,
      stdout: (err.stdout?.toString('utf-8') || '') + (err.stderr?.toString('utf-8') || ''),
    };
  }
}

describe('CLI ndag lint', () => {
  it('exits 0 on warn/info only and exits 1 on error findings with --json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-lint-test-'));
    try {
      await fs.writeFile(
        path.join(tmpDir, '0001-old.md'),
        `---\nid: ADR-0001\ntitle: Old\nstatus: superseded\n---\n# Old\n`
      );

      // Only warn + info => exit 0
      const warnRun = runLintCli([tmpDir, '--json'], tmpDir);
      expect(warnRun.status).toBe(0);
      const warnJson = JSON.parse(warnRun.stdout);
      expect(warnJson.summary.errors).toBe(0);
      expect(warnJson.summary.warnings).toBe(1);

      // Add an accepted -> deprecated dependency => exit 1
      await fs.writeFile(
        path.join(tmpDir, '0002-new.md'),
        `---\nid: ADR-0002\ntitle: New\nstatus: accepted\ndepends_on:\n  - ADR-0001\n---\n# New\n`
      );
      const errRun = runLintCli([tmpDir, '--json'], tmpDir);
      expect(errRun.status).toBe(1);
      const errJson = JSON.parse(errRun.stdout);
      expect(errJson.summary.errors).toBeGreaterThanOrEqual(1);

      // Respect .nirnayrc.json disabling the error rule => exit 0
      await fs.writeJson(path.join(tmpDir, '.nirnayrc.json'), {
        rules: {
          'accepted-depends-on-deprecated': 'off',
        },
      });
      const overrideRun = runLintCli([tmpDir, '--json'], tmpDir);
      expect(overrideRun.status).toBe(0);
    } finally {
      await fs.remove(tmpDir);
    }
  }, 30000);
});
