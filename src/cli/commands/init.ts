import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export const initCommand = new Command('init')
  .description('Scaffolds a .nirnay/ configuration directory and an adrs/ folder')
  .action(async () => {
    const spinner = ora('Initializing NirnayDAG workspace...').start();
    const adrsDir = path.resolve(process.cwd(), 'adrs');
    const configDir = path.resolve(process.cwd(), '.nirnay');
    const configFile = path.join(process.cwd(), '.nirnayrc.json');

    try {
      await fs.ensureDir(configDir);
      await fs.ensureDir(adrsDir);

      const starterAdR = path.join(adrsDir, 'ADR-001-init.md');
      
      const exists = await fs.pathExists(starterAdR);
      if (!exists) {
        await fs.writeFile(
          starterAdR,
          `---
id: ADR-001
title: Initial Project Scaffold
category: Infrastructure
status: accepted
timestamp: ${new Date().toISOString().split('T')[0]}
dependencies: []
---

## Context
We need a structured way to track architectural decisions for this project.

## Decision
Adopt NirnayDAG to maintain our ADRs as a topological graph.

## Consequences

### Positive
- Unified decision log
- Traceable blast radius for future changes

### Negative
- Slight overhead for documenting decisions
`
        );
      }

      if (!(await fs.pathExists(configFile))) {
        await fs.writeJson(configFile, {
          version: "0.1.0",
          adrsDir: "./adrs"
        }, { spaces: 2 });
      }

      spinner.succeed(chalk.green('Workspace initialized successfully.'));
      console.log(chalk.cyan(`Created ${adrsDir}`));
      console.log(chalk.cyan(`Created ${configDir}`));
      console.log(chalk.cyan(`Created ${configFile}`));
    } catch (err: any) {
      spinner.fail(chalk.red('Failed to initialize workspace.'));
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });
