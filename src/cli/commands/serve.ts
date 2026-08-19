import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';

export const serveCommand = new Command('serve')
  .description('Launches local fastify/vite development server serving the interactive visualizer')
  .option('-p, --port <number>', 'Port to run the server on', '3000')
  .action((options) => {
    console.log(chalk.cyan('Starting NirnayDAG visualizer...'));
    
    const child = spawn('npx', ['vite', '--port', options.port], {
      stdio: 'inherit',
      shell: true
    });

    child.on('error', (err) => {
      console.error(chalk.red('Failed to start Vite server:'), err);
      process.exit(1);
    });
  });
