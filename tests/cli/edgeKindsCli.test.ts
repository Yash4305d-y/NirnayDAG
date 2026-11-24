import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

describe('CLI Edge Kinds (validate --strict-refs, blast)', () => {
  let tmpDir: string;
  const tsxBin = path.resolve('node_modules/.bin/tsx' + (process.platform === 'win32' ? '.cmd' : ''));
  const cliEntry = path.resolve('src/cli/index.ts');

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-edge-kinds-'));
    await fs.writeFile(
      path.join(tmpDir, '0001-base.md'),
      `---\nid: ADR-0001\ntitle: Base\nstatus: accepted\n---\n# Base\nSee [ADR-0002].\n`
    );
    await fs.writeFile(
      path.join(tmpDir, '0002-peer.md'),
      `---\nid: ADR-0002\ntitle: Peer\nstatus: accepted\n---\n# Peer\nSee [ADR-0001].\n`
    );
    await fs.writeFile(
      path.join(tmpDir, '0003-child.md'),
      `---\nid: ADR-0003\ntitle: Child\nstatus: accepted\ndepends_on:\n  - ADR-0001\n---\n# Child\n`
    );
  });

  afterAll(async () => {
    await fs.remove(tmpDir);
  });

  const runCli = (args: string[]) => {
    return spawnSync(tsxBin, [cliEntry, ...args], {
      shell: process.platform === 'win32',
      encoding: 'utf-8',
    });
  };

  it('validate ignores soft mutual references and exits 0', () => {
    const res = runCli(['validate', tmpDir, '--json']);
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.valid).toBe(true);
    expect(parsed.mutualReferences).toEqual([{ pair: ['ADR-0001', 'ADR-0002'] }]);
  });

  it('validate --strict-refs turns soft mutual references into warnings', () => {
    const res = runCli(['validate', tmpDir, '--strict-refs']);
    expect(res.status).toBe(0);
    expect(res.stdout + res.stderr).toContain('Warning');
    expect(res.stdout + res.stderr).toContain('ADR-0001');
    expect(res.stdout + res.stderr).toContain('ADR-0002');
  });

  it('blast separates hard dependents from alsoReferencedBy by default and supports --include-soft', () => {
    const defaultRes = runCli(['blast', 'ADR-0001', tmpDir, '--json']);
    expect(defaultRes.status).toBe(0);
    const defaultJson = JSON.parse(defaultRes.stdout);
    expect(defaultJson.directDependents).toBe(1);
    expect(defaultJson.cascadeCount).toBe(1);
    expect(defaultJson.alsoReferencedBy).toEqual(['ADR-0002']);

    const softRes = runCli(['blast', 'ADR-0001', tmpDir, '--include-soft', '--json']);
    expect(softRes.status).toBe(0);
    const softJson = JSON.parse(softRes.stdout);
    expect(softJson.directDependents).toBe(2);
    expect(softJson.cascadeCount).toBe(2);
  });
});
