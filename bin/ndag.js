#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Note: To ensure execution permissions on macOS/Linux, run `chmod +x bin/ndag.js`
const distCli = path.resolve(__dirname, '../dist/cli.js');
const srcCli = path.resolve(__dirname, '../src/cli/index.ts');

if (fs.existsSync(distCli)) {
  // Use node for production bundled CLI
  spawnSync('node', [distCli, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
} else {
  // Fallback to tsx for development
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  spawnSync(npxCmd, ['tsx', srcCli, ...process.argv.slice(2)], {
    stdio: 'inherit'
  });
}
