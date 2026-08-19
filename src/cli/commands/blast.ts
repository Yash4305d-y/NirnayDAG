import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import glob from 'fast-glob';
import fs from 'fs-extra';
import { DAGEngine } from '../../core/dagEngine';
import { parseADRMarkdown } from '../../parser/adrParser';

export const blastCommand = new Command('blast')
  .argument('<adr-id>', 'The ID of the decision to calculate blast radius for (e.g., ADR-002)')
  .description('Computes downstream impacted ADRs')
  .action(async (adrId: string) => {
    const spinner = ora(`Calculating blast radius for ${adrId}...`).start();
    const adrsDir = path.resolve(process.cwd(), 'adrs');

    try {
      const files = await glob('**/*.md', { cwd: adrsDir, absolute: true });
      const adrs = [];
      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        adrs.push(parseADRMarkdown(content));
      }
      
      const engine = new DAGEngine(adrs);
      
      if (!adrs.find(a => a.id === adrId)) {
        spinner.fail(chalk.red(`ADR ${adrId} not found.`));
        process.exit(1);
      }

      const impacted = engine.getBlastRadius(adrId);
      spinner.stop();

      console.log(chalk.bold.hex('#f59e0b')(`\n💥 Blast Radius for ${adrId}`));
      console.log(chalk.gray('===========================\n'));

      if (impacted.length === 0) {
        console.log(chalk.green('No downstream dependencies impacted.'));
      } else {
        console.log(chalk.yellow(`${impacted.length} downstream decisions impacted:`));
        
        const printTree = (nodeId: string, indent: number, visited: Set<string>) => {
          if (visited.has(nodeId)) {
             console.log(`${' '.repeat(indent)}└─ ${chalk.red(nodeId)} (cycle)`);
             return;
          }
          visited.add(nodeId);
          console.log(`${' '.repeat(indent)}└─ ${chalk.yellow(nodeId)}`);
          
          const dependents = adrs.filter(a => a.dependencies.includes(nodeId)).map(a => a.id);
          dependents.forEach(dep => {
            printTree(dep, indent + 2, new Set(visited));
          });
        };
        
        const directDependents = adrs.filter(a => a.dependencies.includes(adrId)).map(a => a.id);
        directDependents.forEach(dep => printTree(dep, 2, new Set([adrId])));
      }
    } catch (err: any) {
      spinner.fail(chalk.red('Failed to calculate blast radius.'));
      console.error(err);
      process.exit(1);
    }
  });
