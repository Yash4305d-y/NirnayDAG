import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';

export const serveCommand = new Command('serve')
  .description('Launch the local NirnayDAG visualizer')
  .argument('[targetDir]', 'Directory containing ADR files', './docs/adr')
  .option('-p, --port <number>', 'Port to run server on', '5173')
  .option('-o, --open', 'Open default browser automatically', true)
  .action((targetDir, options) => {
    console.log(chalk.cyan(`Starting NirnayDAG UI on port ${options.port} for ADRs in ${targetDir}...`));
    
    const viteBinary = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const args = ['vite', '--port', options.port.toString()];
    if (options.open) args.push('--open');
    
    const child = spawn(viteBinary, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        VITE_ADR_DIR: path.resolve(targetDir)
      }
    });

    child.on('error', (err) => {
      console.error(chalk.red(`Failed to start visualizer: ${err.message}`));
      process.exit(1);
    });
  });
