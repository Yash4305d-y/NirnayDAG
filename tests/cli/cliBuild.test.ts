import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

describe('Built CLI Module & Execution', () => {
  const distCliPath = path.resolve(__dirname, '../../dist/cli.js');
  const distCliCjsPath = path.resolve(__dirname, '../../dist/cli.cjs');

  it('ensures dist/cli.js exists and dist/cli.cjs is not emitted', () => {
    expect(fs.existsSync(distCliPath)).toBe(true);
    expect(fs.existsSync(distCliCjsPath)).toBe(false);
  });

  it('runs built CLI with --help (node dist/cli.js --help)', () => {
    const output = execSync(`node ${distCliPath} --help`, { encoding: 'utf-8' });
    expect(output).toContain('Usage: ndag');
    expect(output).toContain('validate');
    expect(output).toContain('blast');
    expect(output).toContain('serve');
    expect(output).toContain('report');
    expect(output).toContain('interactive');
  });

  it('runs built CLI with --version', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')
    );
    const output = execSync(`node ${distCliPath} --version`, { encoding: 'utf-8' });
    expect(output.trim()).toBe(pkg.version);
  });
});
