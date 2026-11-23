import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs-extra';

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
  });
});
