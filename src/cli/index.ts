#!/usr/bin/env tsx
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { validateCommand } from './commands/validate.js';
import { blastCommand } from './commands/blast.js';
import { serveCommand } from './commands/serve.js';
import { mcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('ndag')
  .description('NirnayDAG CLI - Architecture Decision Graph Tool')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(validateCommand);
program.addCommand(blastCommand);
program.addCommand(serveCommand);
program.addCommand(mcpCommand);

program.parse(process.argv);
