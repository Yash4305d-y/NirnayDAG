import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs-extra';
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
});
