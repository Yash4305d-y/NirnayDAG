import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import {
  listDecisionFiles,
  loadNirnayConfig,
  DEFAULT_EXCLUDE_GLOBS,
} from '../src/core/decisionLoader.js';

describe('Decision file loader & .nirnayrc.json include/exclude', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-loader-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('excludes template*, _template*, and *.template.md by default while keeping README.md and mid-name template ADRs', async () => {
    await fs.writeFile(path.join(tmpDir, '0001-use-postgres.md'), '# 1');
    await fs.writeFile(path.join(tmpDir, '0039-use-apache-velocity-as-template-engine.md'), '# 39');
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Index');
    await fs.writeFile(path.join(tmpDir, 'template.md'), '# Tpl');
    await fs.writeFile(path.join(tmpDir, 'template-adr.md'), '# Tpl2');
    await fs.writeFile(path.join(tmpDir, '_template.md'), '# Tpl3');
    await fs.writeFile(path.join(tmpDir, 'adr.template.md'), '# Tpl4');

    const result = await listDecisionFiles(tmpDir);
    const relIncluded = result.included.map((f) => path.relative(tmpDir, f).replace(/\\/g, '/')).sort();
    const relExcluded = result.excluded.map((f) => path.relative(tmpDir, f).replace(/\\/g, '/')).sort();

    expect(DEFAULT_EXCLUDE_GLOBS.length).toBeGreaterThanOrEqual(3);
    expect(relIncluded).toEqual([
      '0001-use-postgres.md',
      '0039-use-apache-velocity-as-template-engine.md',
      'README.md',
    ]);
    expect(relExcluded).toEqual([
      '_template.md',
      'adr.template.md',
      'template-adr.md',
      'template.md',
    ]);
  });

  it('supports KEP-style directory layout with README.md decision files and no config', async () => {
    await fs.ensureDir(path.join(tmpDir, 'sig-api/1027-api-unions'));
    await fs.ensureDir(path.join(tmpDir, 'sig-node/2001-node-feature'));
    await fs.ensureDir(path.join(tmpDir, 'NNNN-kep-template'));
    await fs.writeFile(path.join(tmpDir, 'sig-api/1027-api-unions/README.md'), '# 1027');
    await fs.writeFile(path.join(tmpDir, 'sig-node/2001-node-feature/README.md'), '# 2001');
    await fs.writeFile(path.join(tmpDir, 'NNNN-kep-template/README.md'), '# KEP Template');
    await fs.writeFile(path.join(tmpDir, 'NNNN-kep-template/template.md'), '# Template');

    const result = await listDecisionFiles(tmpDir);
    const relIncluded = result.included.map((f) => path.relative(tmpDir, f).replace(/\\/g, '/')).sort();

    expect(relIncluded).toEqual([
      'NNNN-kep-template/README.md',
      'sig-api/1027-api-unions/README.md',
      'sig-node/2001-node-feature/README.md',
    ]);
  });

  it('applies include and exclude globs from .nirnayrc.json', async () => {
    await fs.writeJson(path.join(tmpDir, '.nirnayrc.json'), {
      version: '0.1.0',
      include: ['adr-*.md'],
      exclude: ['adr-000-template.md', 'PROCESS.md'],
    });
    await fs.writeFile(path.join(tmpDir, 'adr-001-init.md'), '# 1');
    await fs.writeFile(path.join(tmpDir, 'adr-002-storage.md'), '# 2');
    await fs.writeFile(path.join(tmpDir, 'adr-000-template.md'), '# Tpl');
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Index');
    await fs.writeFile(path.join(tmpDir, 'PROCESS.md'), '# Process');

    const config = await loadNirnayConfig(tmpDir);
    expect(config.include).toEqual(['adr-*.md']);
    expect(config.exclude).toEqual(['adr-000-template.md', 'PROCESS.md']);

    const result = await listDecisionFiles(tmpDir);
    const relIncluded = result.included.map((f) => path.relative(tmpDir, f).replace(/\\/g, '/')).sort();
    const relExcluded = result.excluded.map((f) => path.relative(tmpDir, f).replace(/\\/g, '/')).sort();

    expect(relIncluded).toEqual(['adr-001-init.md', 'adr-002-storage.md']);
    expect(relExcluded).toEqual(['PROCESS.md', 'README.md', 'adr-000-template.md']);
  });
});
