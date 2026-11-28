import { describe, it, expect, afterAll } from 'vitest';
import http from 'node:http';
import path from 'path';
import { startServer, type ServerInstance } from '../src/server/serve.js';

describe('Local Static & API Server (ndag serve)', () => {
  let serverInstance: ServerInstance | null = null;
  const fixtureDir = path.resolve(__dirname, '../sample-adrs');

  afterAll(async () => {
    if (serverInstance) {
      await serverInstance.close();
      serverInstance = null;
    }
  });

  it('starts server on 127.0.0.1 with ephemeral port and serves /api/adrs', async () => {
    // Port 0 allocates an available port dynamically
    serverInstance = await startServer({
      dir: fixtureDir,
      port: 0,
      open: false,
    });

    expect(serverInstance.host).toBe('127.0.0.1');
    expect(serverInstance.port).toBeGreaterThan(0);

    const apiUrl = `http://127.0.0.1:${serverInstance.port}/api/adrs`;
    const res = await fetch(apiUrl);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const data = await res.json();
    expect(data).toHaveProperty('files');
    expect(data).toHaveProperty('count');
    expect(data.count).toBeGreaterThanOrEqual(5);

    const sampleFile = data.files.find((f: any) => f.name.includes('0001-microservices-core'));
    expect(sampleFile).toBeDefined();
    expect(sampleFile.content).toContain('Microservices Core Architecture');
  });

  it('serves root HTML page from dist', async () => {
    expect(serverInstance).not.toBeNull();
    const res = await fetch(`http://127.0.0.1:${serverInstance!.port}/`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('<!doctype html>');
  });

  it('blocks path traversal attempts on static files', async () => {
    expect(serverInstance).not.toBeNull();
    const { status, body } = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.get(
        {
          hostname: '127.0.0.1',
          port: serverInstance!.port,
          path: '/%2e%2e/package.json',
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        }
      );
      req.on('error', reject);
    });
    expect(status).toBe(403);
    expect(body).not.toContain('nirnay-dag');
  });

  it('handles non-existent ADR directory with 404 on /api/adrs', async () => {
    const notFoundServer = await startServer({
      dir: './non-existent-folder-xyz',
      port: 0,
      open: false,
    });

    try {
      const res = await fetch(`http://127.0.0.1:${notFoundServer.port}/api/adrs`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.files).toEqual([]);
      expect(data.count).toBe(0);
    } finally {
      await notFoundServer.close();
    }
  });
});
