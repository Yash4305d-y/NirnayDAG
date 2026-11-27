import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import { validateSafeRepoPaths } from '../src/mcp/tools.js';

describe('MCP Server Integration', () => {
  let serverProcess: ChildProcess;
  let rpcId = 1;

  beforeAll(async () => {
    await fs.ensureDir('adrs');
    await fs.writeFile('adrs/ADR-001-test.md', `---
id: ADR-001
title: Test
category: Infrastructure
status: accepted
timestamp: 2026-05-05
dependencies: []
affects:
  - "src/core/**"
---
## Context
Ctx
## Decision
Dec
`);

    const tsxPath = path.resolve('node_modules/.bin/tsx' + (process.platform === 'win32' ? '.cmd' : ''));
    serverProcess = spawn(tsxPath, ['src/mcp/server.ts'], {
      shell: process.platform === 'win32',
      env: { ...process.env, ADR_DIR: './adrs' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start MCP server:', err);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`MCP stderr: ${data.toString()}`);
    });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }
    await fs.remove('adrs/ADR-001-test.md');
  });

  const sendRpc = (method: string, params: any = {}): Promise<any> => {
    return new Promise((resolve, reject) => {
      const id = rpcId++;
      const payload = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      const onData = (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const res = JSON.parse(line);
            if (res.id === id) {
              serverProcess.stdout!.removeListener('data', onData);
              if (res.error) reject(res.error);
              else resolve(res.result);
            }
          } catch {
            // Ignore non-JSON log lines or partial chunks from server stdout
          }
        }
      };

      serverProcess.stdout!.on('data', onData);
      serverProcess.stdin!.write(payload + '\n');
    });
  };

  it('should initialize successfully', async () => {
    const initRes = await sendRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    });
    // send notification without ID
    serverProcess.stdin!.write(JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    }) + '\n');
    
    expect(initRes.protocolVersion).toBe('2024-11-05');
  });

  it('should handle get_decision_graph', async () => {
    const result = await sendRpc('tools/call', {
      name: 'list_adrs',
      arguments: {}
    });
    expect(result.content[0].type).toBe('text');
    const adrs = JSON.parse(result.content[0].text);
    expect(adrs.length).toBeGreaterThan(0);
    // At least one ADR should be our test ADR
    expect(adrs.some((a: any) => a.id === 'ADR-001')).toBe(true);
  });

  it('should handle get_blast_radius with valid id', async () => {
    const result = await sendRpc('tools/call', {
      name: 'query_blast_radius',
      arguments: { id: 'ADR-001' }
    });
    expect(result.content[0].type).toBe('text');
    const res = JSON.parse(result.content[0].text);
    expect(typeof res.architectureRiskScore).toBe('number');
    expect(res.affectedSystems).toBeDefined();
    expect(typeof res.affectedSystems).toBe('object');
    expect(res.riskBreakdown).toBeDefined();
    expect(res.riskLevel).toBeDefined();
    expect(res.riskModelVersion).toBe('v2');
    expect(res.riskBreakdown.betweennessCentrality).toBeDefined();
    expect(Array.isArray(res.alsoReferencedBy)).toBe(true);
  });

  it('should handle lint_architecture tool', async () => {
    const result = await sendRpc('tools/call', {
      name: 'lint_architecture',
      arguments: {}
    });
    expect(result.content[0].type).toBe('text');
    const res = JSON.parse(result.content[0].text);
    expect(res.summary).toBeDefined();
    expect(Array.isArray(res.findings)).toBe(true);
  });

  it('should handle get_blast_radius with invalid id gracefully', async () => {
    const result = await sendRpc('tools/call', {
      name: 'query_blast_radius',
      arguments: { id: 'INVALID-999' }
    });
    expect(result.content[0].type).toBe('text');
    const res = JSON.parse(result.content[0].text);
    expect(res.totalCascadingDownstream).toEqual([]);
  });

  it('should handle validate_architecture_dag', async () => {
    const result = await sendRpc('tools/call', {
      name: 'validate_architecture',
      arguments: {}
    });
    const res = JSON.parse(result.content[0].text);
    expect(typeof res.hasCycles).toBe('boolean');
    expect(Array.isArray(res.rootDecisions)).toBe(true);
    expect(res.rootDecisions.length).toBeGreaterThan(0);
    expect(res.rootDecisions).toContain('ADR-001');
    expect(Array.isArray(res.mutualReferences)).toBe(true);
  });

  it('should handle get_adrs_for_files with valid repo-relative paths', async () => {
    const result = await sendRpc('tools/call', {
      name: 'get_adrs_for_files',
      arguments: { paths: ['src/core/dagEngine.ts', 'README.md'] }
    });
    expect(result.isError).not.toBe(true);
    const res = JSON.parse(result.content[0].text);
    expect(res.results).toHaveLength(2);
    expect(res.results[0].file).toBe('src/core/dagEngine.ts');
    expect(res.results[0].decisions[0].id).toBe('ADR-001');
    expect(res.results[1].decisions).toEqual([]);
  });

  it('should reject path traversal and absolute paths in get_adrs_for_files', async () => {
    const absRes = await sendRpc('tools/call', {
      name: 'get_adrs_for_files',
      arguments: { paths: ['/etc/passwd'] }
    });
    expect(absRes.isError).toBe(true);

    const travRes = await sendRpc('tools/call', {
      name: 'get_adrs_for_files',
      arguments: { paths: ['../secret.txt'] }
    });
    expect(travRes.isError).toBe(true);

    const winTravRes = await sendRpc('tools/call', {
      name: 'get_adrs_for_files',
      arguments: { paths: ['..\\..\\Windows\\win.ini'] }
    });
    expect(winTravRes.isError).toBe(true);
  });
});

describe('get_adrs_for_files path security', () => {
  it('rejects absolute paths, .. traversal, out-of-repo resolution, and symlinks', async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-mcp-sec-'));
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ndag-mcp-outside-'));
    try {
      await fs.ensureDir(path.join(tmpRoot, 'src'));
      await fs.writeFile(path.join(tmpRoot, 'src', 'ok.ts'), 'export {};');
      await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'secret');

      // Valid relative path
      expect(validateSafeRepoPaths(['src/ok.ts'], tmpRoot)).toEqual(['src/ok.ts']);

      // Reject POSIX absolute path
      expect(() => validateSafeRepoPaths(['/etc/passwd'], tmpRoot)).toThrow(/absolute/i);

      // Reject Windows absolute path & UNC path
      expect(() => validateSafeRepoPaths(['C:\\Windows\\System32\\cmd.exe'], tmpRoot)).toThrow(/absolute/i);
      expect(() => validateSafeRepoPaths(['\\\\server\\share\\file.ts'], tmpRoot)).toThrow(/absolute/i);

      // Reject .. traversal (POSIX and Windows separators)
      expect(() => validateSafeRepoPaths(['../secret.txt'], tmpRoot)).toThrow(/\.\./);
      expect(() => validateSafeRepoPaths(['src/../../secret.txt'], tmpRoot)).toThrow(/\.\./);
      expect(() => validateSafeRepoPaths(['..\\..\\Windows\\win.ini'], tmpRoot)).toThrow(/\.\./);

      // Reject symlinked directory/file without following
      const linkPath = path.join(tmpRoot, 'src', 'linked');
      await fs.symlink(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      expect(() => validateSafeRepoPaths(['src/linked/secret.txt'], tmpRoot)).toThrow(/symlink/i);
    } finally {
      await fs.remove(tmpRoot);
      await fs.remove(outsideDir);
    }
  });
});
