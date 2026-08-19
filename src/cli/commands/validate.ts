import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import glob from 'fast-glob';
import fs from 'fs-extra';
import Table from 'cli-table3';
import { DAGEngine } from '../../core/dagEngine.js';
import { parseADRMarkdown } from '../../parser/adrParser.js';

export const validateCommand = new Command('validate')
  .description('Validates the ADR graph for cycles and missing dependencies')
  .action(async () => {
    const spinner = ora('Scanning ADRs...').start();
    const adrsDir = path.resolve(process.cwd(), 'adrs');

    try {
      const files = await glob('**/*.md', { cwd: adrsDir, absolute: true });
      if (files.length === 0) {
        spinner.warn(chalk.yellow('No ADRs found in the adrs/ directory.'));
        return;
      }

      const adrs: NirnayADR[] = [];
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        adrs.push(parseADRMarkdown(content));
      }

      spinner.text = 'Validating graph...';
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      spinner.stop();

      const table = new Table({
        head: [chalk.cyan('ID'), chalk.cyan('Title'), chalk.cyan('Status'), chalk.cyan('Dependencies')],
        colWidths: [15, 50, 15, 15]
      });

      adrs.forEach(adr => {
        let statusColor = chalk.white;
        if (adr.status === 'accepted') statusColor = chalk.green;
        if (adr.status === 'proposed') statusColor = chalk.yellow;
        if (adr.status === 'superseded') statusColor = chalk.blue;
        if (adr.status === 'deprecated') statusColor = chalk.red;

        table.push([
          adr.id,
          adr.title.length > 47 ? adr.title.substring(0, 44) + '...' : adr.title,
          statusColor(adr.status),
          adr.dependencies.length.toString()
        ]);
      });

      console.log(table.toString());
      console.log(chalk.white(`\nTotal Decisions: ${adrs.length}`));
      
      if (result.isValid) {
        console.log(chalk.green('✅ Graph is valid. No cycles or missing dependencies.'));
        console.log(chalk.cyan(`Topological Order: ${result.topologicalOrder.join(' -> ')}`));
      } else {
        console.log(chalk.red('❌ Validation failed!'));
        
        if (result.hasCycle && result.cyclePath) {
          console.log(chalk.red.bold('\nCircular Dependency Detected:'));
          console.log(chalk.red.bold(`  ${result.cyclePath.join(' -> ')}`));
        }

        if (result.missingDependencies.length > 0) {
          console.log(chalk.red.bold('\nMissing Dependencies:'));
          result.missingDependencies.forEach(m => {
            console.log(chalk.red(`  ${m.adrId} references non-existent [${m.missingId}]`));
          });
        }
        process.exit(1);
      }
    } catch (err: any) {
      spinner.fail(chalk.red('Error during validation.'));
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });
