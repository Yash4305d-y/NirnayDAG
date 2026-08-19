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

    serverProcess = spawn('npx', ['tsx', 'src/mcp/server.ts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterAll(async () => {
    serverProcess.kill();
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
        const lines = data.toString().split('\\n').filter(Boolean);
        for (const line of lines) {
          try {
            const res = JSON.parse(line);
            if (res.id === id) {
              serverProcess.stdout!.removeListener('data', onData);
              if (res.error) reject(res.error);
              else resolve(res.result);
            }
          } catch (e) {}
        }
      };

      serverProcess.stdout!.on('data', onData);
      serverProcess.stdin!.write(payload + '\\n');
    });
  };

  it('should initialize successfully', async () => {
    const initRes = await sendRpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '1.0.0' }
    });
    await sendRpc('notifications/initialized');
    expect(initRes.protocolVersion).toBe('2024-11-05');
  });

  it('should handle get_decision_graph', async () => {
    const result = await sendRpc('tools/call', {
      name: 'get_decision_graph',
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
      name: 'get_blast_radius',
      arguments: { adrId: 'ADR-001' }
    });
    expect(result.content[0].type).toBe('text');
    const res = JSON.parse(result.content[0].text);
    expect(res.targetNode).toBe('ADR-001');
    expect(typeof res.totalImpacted).toBe('number');
  });

  it('should handle get_blast_radius with invalid id gracefully', async () => {
    const result = await sendRpc('tools/call', {
      name: 'get_blast_radius',
      arguments: { adrId: 'INVALID-999' }
    });
    expect(result.content[0].type).toBe('text');
    const res = JSON.parse(result.content[0].text);
    expect(res.targetNode).toBe('INVALID-999');
    expect(res.totalImpacted).toBe(0);
  });

  it('should handle validate_architecture_dag', async () => {
    const result = await sendRpc('tools/call', {
      name: 'validate_architecture_dag',
      arguments: {}
    });
    const res = JSON.parse(result.content[0].text);
    expect(typeof res.isValid).toBe('boolean');
  });
});
