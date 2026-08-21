import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import glob from 'fast-glob';
import { parseADRMarkdown } from '../../parser/adrParser.js';
import { DAGEngine } from '../../core/dagEngine.js';
import type { NirnayADR } from '../../core/types.js';

export const blastCommand = new Command('blast')
  .argument('<id>', 'ADR ID to calculate blast radius for')
  .description('Calculate the downstream dependency tree (blast radius)')
  .action(async (id: string) => {
    const spinner = ora(`Calculating blast radius for ${id}...`).start();
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
      const impacted = engine.getBlastRadius(id);
      
      spinner.succeed(chalk.green(`Blast radius calculation complete for ${id}`));
      
      if (impacted.length === 0) {
        console.log(chalk.gray(`\nNo downstream dependencies impacted by ${id}.`));
      } else {
        console.log(chalk.yellow(`\nImpacted downstream nodes (${impacted.length}):`));
        impacted.forEach(i => console.log(`  - ${chalk.cyan(i)}`));
      }
    } catch (err: any) {
      spinner.fail(chalk.red(`Blast calculation failed: ${err.message}`));
      process.exit(1);
    }
  });
