#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliEntry = path.resolve(__dirname, '../src/cli/index.ts');

spawnSync('npx', ['tsx', cliEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true
});
