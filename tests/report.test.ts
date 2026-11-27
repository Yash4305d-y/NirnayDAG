import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { generatePRReport } from '../src/core/report.js';

describe('PR Blast Radius Report Generator', () => {
  const tmpDir = path.resolve(__dirname, '../.tmp-report-test');
  const fixtureDir = path.resolve(__dirname, '../sample-adrs');

  beforeEach(async () => {
    await fs.ensureDir(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('generates a full PR blast radius report with mock changed files', async () => {
    const outputFile = path.join(tmpDir, 'test-summary.md');
    const result = await generatePRReport({
      adrDir: fixtureDir,
      outputFile,
      mockChangedFiles: ['sample-adrs/0001-microservices-core.md'],
    });

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = await fs.readFile(outputFile, 'utf-8');

    expect(content).toContain('# Architecture Decision Graph (ADR) Blast Radius');
    expect(content).toContain('| ADR ID | Title | Status | Cascade Count | Max Depth | Affected Systems | Risk Level |');
    expect(content).toContain('**ADR-0001**');
    expect(content).toContain('Microservices Core Architecture');
    expect(content).toContain('<details>');
    expect(content).toContain('cascades to');

    expect(result.changedCount).toBe(1);
    expect(result.totalCount).toBeGreaterThanOrEqual(5);
    expect(result.lintResult).toBeDefined();
    expect(content).toContain('Architecture Lint Results');
  });

  it('generates report when no ADRs were modified', async () => {
    const outputFile = path.join(tmpDir, 'no-changes.md');
    const result = await generatePRReport({
      adrDir: fixtureDir,
      outputFile,
      mockChangedFiles: ['README.md'], // non-ADR change
    });

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = await fs.readFile(outputFile, 'utf-8');
    expect(content).toContain('*No ADR files were modified in this PR.*');
    expect(result.changedCount).toBe(0);
  });

  it('handles non-existent ADR directory gracefully', async () => {
    const outputFile = path.join(tmpDir, 'not-found.md');
    const result = await generatePRReport({
      adrDir: path.join(tmpDir, 'non-existent-dir'),
      outputFile,
    });

    expect(fs.existsSync(outputFile)).toBe(true);
    const content = await fs.readFile(outputFile, 'utf-8');
    expect(content).toContain('*ADR directory not found.*');
    expect(result.changedCount).toBe(0);
    expect(result.totalCount).toBe(0);
  });

  it('runs report via built CLI command directly', async () => {
    const distCliPath = path.resolve(__dirname, '../dist/cli.js');
    const { execSync } = await import('child_process');
    // Run CLI report command with fixture dir
    const out = execSync(`node ${distCliPath} report ${fixtureDir}`, {
      encoding: 'utf-8',
      cwd: tmpDir,
      env: { ...process.env, MOCK_CHANGED_FILES: 'sample-adrs/0001-microservices-core.md' }
    });
    expect(out).toContain('Successfully wrote PR blast radius summary');
    const summaryFile = path.join(tmpDir, 'nirnay-pr-summary.md');
    expect(fs.existsSync(summaryFile)).toBe(true);
    const content = await fs.readFile(summaryFile, 'utf-8');
    expect(content).toContain('**ADR-0001**');
  });

  it('runs report in a temp folder that is not a git repo without printing git usage', async () => {
    const distCliPath = path.resolve(__dirname, '../dist/cli.js');
    const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-non-git-'));
    try {
      const { spawnSync } = await import('child_process');
      const env = { ...process.env };
      delete env.MOCK_CHANGED_FILES;

      const res = spawnSync(process.execPath, [distCliPath, 'report', fixtureDir], {
        cwd: nonGitDir,
        env,
        encoding: 'utf-8',
      });

      expect(res.status).toBe(0);
      // Catch git failure without printing git usage text
      expect(res.stderr).not.toMatch(/usage:\s+git\s+diff/i);
      expect(res.stderr).not.toContain('Diff output format options');

      // Print one short warning line
      expect(res.stderr).toContain('Could not detect changed files via git');
      const warningLines = res.stderr.trim().split(/\r?\n/).filter(Boolean);
      expect(warningLines.length).toBe(1);

      // Continues with all ADRs
      const summaryFile = path.join(nonGitDir, 'nirnay-pr-summary.md');
      expect(fs.existsSync(summaryFile)).toBe(true);
      const content = await fs.readFile(summaryFile, 'utf-8');
      expect(content).toContain('**ADR-0001**');
      expect(content).toContain('**ADR-0002**');
      expect(content).toContain('**ADR-0003**');
      expect(content).toContain('**ADR-0004**');
      expect(content).toContain('**ADR-0005**');
    } finally {
      await fs.remove(nonGitDir);
    }
  });

  it('handles git failure in generatePRReport outside git repo cleanly', async () => {
    const nonGitDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-core-non-git-'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const prevEnv = process.env.MOCK_CHANGED_FILES;
      delete process.env.MOCK_CHANGED_FILES;

      const result = await generatePRReport({
        adrDir: fixtureDir,
        cwd: nonGitDir,
      });

      // Continues with all ADRs
      expect(result.changedCount).toBe(result.totalCount);
      expect(result.changedCount).toBeGreaterThanOrEqual(5);

      // Warning line checks
      expect(warnSpy).toHaveBeenCalled();
      const warningCall = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('Could not detect changed files via git')
      );
      expect(warningCall).toBeDefined();
      const warningMsg = String(warningCall![0]);
      expect(warningMsg).not.toMatch(/usage:\s+git\s+diff/i);
      expect(warningMsg.split(/\r?\n/).length).toBe(1);

      if (prevEnv !== undefined) {
        process.env.MOCK_CHANGED_FILES = prevEnv;
      }
    } finally {
      warnSpy.mockRestore();
      await fs.remove(nonGitDir);
    }
  });

  it('handles git failure when baseRef does not exist cleanly', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const prevEnv = process.env.MOCK_CHANGED_FILES;
      delete process.env.MOCK_CHANGED_FILES;

      const result = await generatePRReport({
        adrDir: fixtureDir,
        baseRef: 'nonexistent-ref-abc-123',
        outputFile: path.join(tmpDir, 'nonexistent-ref.md'),
      });

      // Continues with all ADRs
      expect(result.changedCount).toBe(result.totalCount);
      expect(result.changedCount).toBeGreaterThanOrEqual(5);

      expect(warnSpy).toHaveBeenCalled();
      const warningCall = warnSpy.mock.calls.find((call) =>
        String(call[0]).includes('Could not detect changed files via git')
      );
      expect(warningCall).toBeDefined();
      const warningMsg = String(warningCall![0]);
      expect(warningMsg).not.toMatch(/usage:\s+git\s+diff/i);
      expect(warningMsg).not.toContain("Use '--' to separate paths from revisions");
      expect(warningMsg.split(/\r?\n/).length).toBe(1);

      if (prevEnv !== undefined) {
        process.env.MOCK_CHANGED_FILES = prevEnv;
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('separates hard dependents from also referenced by and ignores soft mutual cycles', async () => {
    const softDir = path.join(tmpDir, 'soft-adrs');
    await fs.ensureDir(softDir);
    await fs.writeFile(
      path.join(softDir, '0001-base.md'),
      `---\nid: ADR-0001\ntitle: Base\nstatus: accepted\n---\n# Base\nSee [ADR-0002].\n`
    );
    await fs.writeFile(
      path.join(softDir, '0002-soft.md'),
      `---\nid: ADR-0002\ntitle: Soft\nstatus: accepted\n---\n# Soft\nSee [ADR-0001].\n`
    );
    await fs.writeFile(
      path.join(softDir, '0003-hard.md'),
      `---\nid: ADR-0003\ntitle: Hard Child\nstatus: accepted\ndepends_on:\n  - ADR-0001\n---\n# Hard Child\n`
    );

    const outputFile = path.join(tmpDir, 'soft-summary.md');
    const result = await generatePRReport({
      adrDir: softDir,
      outputFile,
      mockChangedFiles: ['0001-base.md'],
    });

    expect(result.validationResult.isValid).toBe(true);
    expect(result.validationResult.hasCycle).toBe(false);
    expect(result.markdown).toContain('Architecture DAG Validated Successfully');
    expect(result.markdown).toContain('Also Referenced By');
    expect(result.markdown).toContain('ADR-0002');
    expect(result.markdown).toContain('Mutual References');
  });
});
