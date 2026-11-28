import http, { type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import { loadDecisionFileInputs } from '../core/decisionLoader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServeOptions {
  dir?: string;
  port?: number | string;
  open?: boolean;
  distDir?: string;
}

export interface ServerInstance {
  server: Server;
  port: number;
  host: string;
  url: string;
  targetDir: string;
  close: () => Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function sendStaticFile(res: ServerResponse, filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const data = await fs.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': data.byteLength,
  });
  res.end(data);
}

function resolveDistDir(explicitDistDir?: string): string | undefined {
  if (explicitDistDir) return explicitDistDir;
  const candidateDirs = [
    __dirname,
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '../../dist'),
    path.resolve(process.cwd(), 'dist'),
  ];
  for (const c of candidateDirs) {
    if (fs.existsSync(path.join(c, 'index.html'))) {
      return c;
    }
  }
  return undefined;
}

export function createServerApp(options: ServeOptions = {}) {
  const targetDir = path.resolve(process.cwd(), options.dir || process.env.ADR_DIR || './docs/adr');
  const distDir = resolveDistDir(options.distDir);
  const resolvedDistDir = distDir ? path.resolve(distDir) : undefined;
  const hasIndexHtml = Boolean(resolvedDistDir && fs.existsSync(path.join(resolvedDistDir, 'index.html')));

  const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Method Not Allowed');
      return;
    }

    let pathname: string;
    let decodedRawPath: string;
    try {
      const rawPath = (req.url || '/').split('?')[0];
      decodedRawPath = decodeURIComponent(rawPath);
      const parsed = new URL(req.url || '/', 'http://127.0.0.1');
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Bad Request');
      return;
    }

    if (decodedRawPath.includes('\0') || decodedRawPath.split(/[\\/]/).includes('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    // 1. Local API endpoint for ADRs in target folder
    if (pathname === '/api/adrs') {
      try {
        if (!fs.existsSync(targetDir)) {
          sendJson(res, 404, {
            error: `ADR directory not found: ${targetDir}`,
            files: [],
            count: 0,
            dir: targetDir,
          });
          return;
        }

        const { files } = await loadDecisionFileInputs(targetDir);
        const fileData = files.map((file) => ({
          name: file.name,
          filePath: file.filePath,
          content: file.content,
          path: file.absPath,
          ...(file.kepYamlContent !== undefined ? { kepYamlContent: file.kepYamlContent } : {}),
        }));

        sendJson(res, 200, {
          files: fileData,
          count: fileData.length,
          dir: targetDir,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, { error: message, files: [], count: 0, dir: targetDir });
      }
      return;
    }

    // 2. Serve built web static assets with path-traversal protection
    if (hasIndexHtml && resolvedDistDir) {
      if (pathname.startsWith('/api/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const relPath = pathname.replace(/^\/+/, '');
      if (relPath.includes('\0') || relPath.split(/[\\/]/).includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const candidate = path.resolve(resolvedDistDir, relPath);
      const isInsideDist =
        candidate === resolvedDistDir || candidate.startsWith(resolvedDistDir + path.sep);
      if (!isInsideDist) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (relPath && fs.existsSync(candidate)) {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          await sendStaticFile(res, candidate);
          return;
        }
      }

      // SPA fallback
      await sendStaticFile(res, path.join(resolvedDistDir, 'index.html'));
      return;
    }

    if (pathname === '/') {
      const html = `<h1>NirnayDAG Server</h1><p>API is active at <a href="/api/adrs">/api/adrs</a>.</p>`;
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html),
      });
      res.end(html);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  };

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end(err instanceof Error ? err.message : 'Internal Server Error');
    });
  });

  return { server, targetDir, distDir };
}

export async function startServer(options: ServeOptions = {}): Promise<ServerInstance> {
  const { server, targetDir } = createServerApp(options);
  const port =
    options.port !== undefined && options.port !== '' && !isNaN(Number(options.port))
      ? Number(options.port)
      : 5173;
  const host = '127.0.0.1';

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      const url = `http://${host}:${actualPort}`;
      console.log(`🚀 NirnayDAG server running at ${url}`);
      console.log(`📁 Serving ADRs from: ${targetDir}`);

      if (options.open) {
        const cmd =
          process.platform === 'win32'
            ? `start ${url}`
            : process.platform === 'darwin'
              ? `open ${url}`
              : `xdg-open ${url}`;
        import('child_process')
          .then((cp) => cp.exec(cmd))
          .catch(() => {});
      }

      resolve({
        server,
        port: actualPort,
        host,
        url,
        targetDir,
        close: () =>
          new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}
