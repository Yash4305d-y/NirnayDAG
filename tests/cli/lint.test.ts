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

  it('detects git repo root from ADR dir when run from outside cwd, supports --root, and handles no-root', async () => {
    const baseTmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-lint-root-'));
    const repoDir = path.join(baseTmp, 'repo');
    const adrDir = path.join(repoDir, 'docs', 'adr');
    const outsideDir = path.join(baseTmp, 'outside');
    const noRootAdrDir = path.join(baseTmp, 'no-root-adrs');

    try {
      await fs.ensureDir(path.join(repoDir, 'src', 'core'));
      await fs.ensureDir(adrDir);
      await fs.ensureDir(outsideDir);
      await fs.ensureDir(noRootAdrDir);

      await fs.writeFile(path.join(repoDir, 'src', 'core', 'engine.ts'), 'export const x = 1;\n');
      execFileSync('git', ['init'], { cwd: repoDir, stdio: 'ignore' });
      execFileSync('git', ['add', 'src/core/engine.ts'], { cwd: repoDir, stdio: 'ignore' });

      await fs.writeFile(
        path.join(adrDir, '0001-core.md'),
        `---\nid: ADR-0001\ntitle: Core\nstatus: accepted\naffects:\n  - "src/core/**"\n---\n# Core\n`
      );
      await fs.writeFile(
        path.join(adrDir, '0002-missing.md'),
        `---\nid: ADR-0002\ntitle: Missing\nstatus: accepted\ndepends_on:\n  - ADR-0001\naffects:\n  - "src/does-not-exist/**"\n---\n# Missing\n`
      );

      // 1. Run built CLI from outside cwd -> auto-detects repoDir, reports exactly 1 affects-no-match warning
      const outsideRun = runLintCli([adrDir, '--json'], outsideDir);
      expect(outsideRun.status).toBe(0);
      const outsideJson = JSON.parse(outsideRun.stdout);
      const noMatchFindings = outsideJson.findings.filter(
        (f: any) => f.ruleId === 'affects-no-match'
      );
      expect(noMatchFindings).toHaveLength(1);
      expect(noMatchFindings[0].message).toContain('src/does-not-exist/**');

      // 2. --root override on an unrooted ADR dir pointing to repoDir
      await fs.writeFile(
        path.join(noRootAdrDir, '0001-external.md'),
        `---\nid: ADR-0001\ntitle: External\nstatus: accepted\naffects:\n  - "src/core/**"\n---\n# External\n`
      );
      const rootOverrideRun = runLintCli(
        [noRootAdrDir, '--root', repoDir, '--json'],
        outsideDir
      );
      expect(rootOverrideRun.status).toBe(0);
      const overrideJson = JSON.parse(rootOverrideRun.stdout);
      expect(
        overrideJson.findings.filter((f: any) => f.ruleId === 'affects-no-match')
      ).toHaveLength(0);

      // 3. No-root case: skips affects-no-match and deprecated-governs-code and prints one info line
      await fs.writeFile(
        path.join(noRootAdrDir, '0002-deprecated.md'),
        `---\nid: ADR-0002\ntitle: Old\nstatus: deprecated\ndepends_on:\n  - ADR-0001\naffects:\n  - "src/missing/**"\n---\n# Old\n`
      );
      const noRootHuman = runLintCli([noRootAdrDir], outsideDir);
      expect(noRootHuman.status).toBe(0);
      expect(noRootHuman.stdout.toLowerCase()).toContain('skipping');
      expect(noRootHuman.stdout).toContain('No lint issues found');

      const noRootJsonRun = runLintCli([noRootAdrDir, '--json'], outsideDir);
      expect(noRootJsonRun.status).toBe(0);
      const noRootJson = JSON.parse(noRootJsonRun.stdout);
      expect(noRootJson.findings).toHaveLength(0);
    } finally {
      await fs.remove(baseTmp);
    }
  }, 30000);
});
