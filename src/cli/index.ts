#!/usr/bin/env tsx
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { blastCommand } from './commands/blast';
import { serveCommand } from './commands/serve';
import { mcpCommand } from './commands/mcp';

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
