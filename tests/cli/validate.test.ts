import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

describe('CLI validate duplicate IDs', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.remove(dir);
    }
    tempDirs.length = 0;
  });

  it('fails ndag validate when two ADRs share the same ID and names both files', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-dup-'));
    tempDirs.push(tmpDir);

    await fs.ensureDir(path.join(tmpDir, 'sig-api'));
    await fs.ensureDir(path.join(tmpDir, 'sig-node'));
    await fs.writeFile(
      path.join(tmpDir, 'sig-api', 'README.md'),
      '---\nid: SHARED-ID\ntitle: First\nstatus: accepted\n---\n# First\n',
      'utf-8'
    );
    await fs.writeFile(
      path.join(tmpDir, 'sig-node', 'README.md'),
      '---\nid: SHARED-ID\ntitle: Second\nstatus: accepted\n---\n# Second\n',
      'utf-8'
    );

    const cliEntry = path.resolve(__dirname, '../../src/cli/index.ts');
    const res = spawnSync('npx', ['tsx', cliEntry, 'validate', tmpDir], {
      encoding: 'utf-8',
      shell: true,
    });

    expect(res.status).not.toBe(0);
    const combinedOutput = `${res.stdout}\n${res.stderr}`;
    expect(combinedOutput).toContain('SHARED-ID');
    expect(combinedOutput).toContain('sig-api/README.md');
    expect(combinedOutput).toContain('sig-node/README.md');
  });
});
