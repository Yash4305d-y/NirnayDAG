import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export const initCommand = new Command('init')
  .description('Initialize NirnayDAG in the current directory')
  .action(async () => {
    const spinner = ora('Initializing NirnayDAG...').start();
    const cwd = process.cwd();
    const adrDir = path.join(cwd, 'adrs');
    const rcFile = path.join(cwd, '.nirnayrc.json');
    const firstAdr = path.join(adrDir, 'ADR-001-initial-architecture.md');

    try {
      if (!fs.existsSync(adrDir)) {
        fs.mkdirSync(adrDir, { recursive: true });
      }

      if (!fs.existsSync(rcFile)) {
        fs.writeFileSync(rcFile, JSON.stringify({ version: "1.0", adrDir: "./adrs" }, null, 2));
      }

      if (!fs.existsSync(firstAdr)) {
        const adrContent = `---
id: ADR-001
title: Initial Architecture
date: ${new Date().toISOString().split('T')[0]}
status: proposed
category: Architecture
context: We need to define the initial architecture for the system.
decision: We will adopt NirnayDAG to track architectural decisions.
---
# Initial Architecture

## Pros
- Standardized documentation
- Blast radius visualization

## Cons
- Small learning curve
`;
        fs.writeFileSync(firstAdr, adrContent);
      }

      spinner.succeed(chalk.green('NirnayDAG initialized successfully. Created /adrs and .nirnayrc.json'));
    } catch (err: any) {
      spinner.fail(chalk.red(`Initialization failed: ${err.message}`));
      process.exit(1);
    }
  });
