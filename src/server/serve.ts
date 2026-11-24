import express from 'express';
import path from 'path';
import fs from 'fs-extra';
import fg from 'fast-glob';
import type { Server } from 'http';

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

export function createServerApp(options: ServeOptions = {}) {
  const app = express();
  const targetDir = path.resolve(process.cwd(), options.dir || process.env.ADR_DIR || './docs/adr');

  // 1. Local API endpoint for ADRs in target folder
  app.get('/api/adrs', async (_req, res) => {
    try {
      if (!fs.existsSync(targetDir)) {
        return res.status(404).json({
          error: `ADR directory not found: ${targetDir}`,
          files: [],
          count: 0,
          dir: targetDir,
        });
      }

      const files = await fg('**/*.{md,mdx}', { cwd: targetDir, absolute: true });
      const fileData = await Promise.all(
        files.map(async (file) => ({
          name: path.basename(file),
          content: await fs.readFile(file, 'utf-8'),
          path: file.replace(/\\/g, '/'),
        }))
      );

      res.json({
        files: fileData,
        count: fileData.length,
        dir: targetDir,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message, files: [], count: 0, dir: targetDir });
    }
  });

  // 2. Locate built web static assets directory
  let distDir = options.distDir;
  if (!distDir) {
    const candidateDirs = [
      __dirname,
      path.resolve(__dirname, '..'),
      path.resolve(__dirname, '../../dist'),
      path.resolve(process.cwd(), 'dist'),
    ];
    for (const c of candidateDirs) {
      if (fs.existsSync(path.join(c, 'index.html'))) {
        distDir = c;
        break;
      }
    }
  }

  if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir));
    // SPA fallback
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir!, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send(
        `<h1>NirnayDAG Server</h1><p>API is active at <a href="/api/adrs">/api/adrs</a>.</p>`
      );
    });
  }

  return { app, targetDir, distDir };
}

export async function startServer(options: ServeOptions = {}): Promise<ServerInstance> {
  const { app, targetDir } = createServerApp(options);
  const port =
    options.port !== undefined && options.port !== '' && !isNaN(Number(options.port))
      ? Number(options.port)
      : 5173;
  const host = '127.0.0.1';

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const actualPort = (server.address() as any)?.port || port;
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

    server.on('error', reject);
  });
}
