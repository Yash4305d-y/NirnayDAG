import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import path from 'path';

export const mcpCommand = new Command('mcp')
  .description('Launches the MCP stdio server for Claude Desktop / Cursor / Antigravity integration')
  .action(() => {
    const serverPath = path.resolve(__dirname, '../../mcp/server.ts');
    const child = spawn('npx', ['tsx', serverPath], {
      stdio: 'inherit',
    });
    
    child.on('error', (err) => {
      console.error(chalk.red('Failed to start MCP server:'), err);
      process.exit(1);
    });
  });
