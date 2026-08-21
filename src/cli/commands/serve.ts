import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';

export const serveCommand = new Command('serve')
  .description('Launch the local NirnayDAG visualizer')
  .action(() => {
    console.log(chalk.cyan('Starting NirnayDAG Visualizer...'));
    const vitePath = path.resolve(process.cwd(), 'node_modules/.bin/vite');
    const child = spawn(vitePath, ['preview'], { stdio: 'inherit', shell: true });
    
    child.on('error', (err) => {
      console.error(chalk.red(`Failed to start visualizer: ${err.message}`));
      process.exit(1);
    });
  });
