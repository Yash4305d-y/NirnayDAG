import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import glob from 'fast-glob';
import Table from 'cli-table3';
import { parseADRMarkdown } from '../../parser/adrParser.js';
import { DAGEngine } from '../../core/dagEngine.js';
import type { NirnayADR } from '../../core/types.js';

export const validateCommand = new Command('validate')
  .description("Validate Kahn's cycle for the architecture decision graph")
  .action(async () => {
    const spinner = ora('Validating ADR DAG...').start();
    const cwd = process.cwd();
    const adrDir = path.join(cwd, 'adrs');
    
    if (!fs.existsSync(adrDir)) {
      spinner.fail(chalk.red('No adrs directory found. Run ndag init first.'));
      process.exit(1);
    }

    try {
      const files = glob.sync('**/*.{md,markdown}', { cwd: adrDir, absolute: true });
      const adrs: NirnayADR[] = [];
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        try {
          adrs.push(parseADRMarkdown(content, path.basename(file)));
        } catch (e) {}
      }
      
      const engine = new DAGEngine(adrs);
      const { isValid, errors } = engine.validate();
      
      spinner.stop();
      
      const table = new Table({
        head: [chalk.cyan('Node ID'), chalk.cyan('Status')],
        colWidths: [30, 20]
      });

      if (isValid) {
        table.push(['Graph Health', chalk.green('Valid - Zero Cycles')]);
        console.log(table.toString());
        console.log(chalk.green('\n✅ Architecture DAG validated successfully.'));
        process.exit(0);
      } else {
        table.push(['Graph Health', chalk.red('Invalid - Cycle Detected')]);
        errors.forEach(e => table.push([chalk.yellow('Error'), chalk.red(e)]));
        console.log(table.toString());
        console.log(chalk.red('\n❌ Validation failed due to cyclic dependencies.'));
        process.exit(1);
      }
      
    } catch (err: any) {
      spinner.fail(chalk.red(`Validation error: ${err.message}`));
      process.exit(1);
    }
  });
