import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';

export const mcpCommand = new Command('mcp')
  .description('Start the Model Context Protocol (MCP) server')
  .action(() => {
    // Determine path based on compiled output or running via tsx
    const ext = process.argv[1].endsWith('.js') ? 'js' : 'ts';
    const serverPath = ext === 'js' 
      ? path.resolve(process.cwd(), 'dist/mcp.js')
      : path.resolve(process.cwd(), 'src/mcp/server.ts');
      
    const cmd = ext === 'js' ? 'node' : 'tsx';
    
    const child = spawn(cmd, [serverPath], { stdio: 'inherit', shell: true });
    
    child.on('error', (err) => {
      console.error(`Failed to start MCP server: ${err.message}`);
      process.exit(1);
    });
  });
