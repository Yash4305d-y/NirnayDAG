#!/usr/bin/env node
import fs from 'fs-extra';
import path from 'path';
import glob from 'fast-glob';
import chalk from 'chalk';
import { parseADRContent } from '../core/adrParser.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';
import type { ParsedADR } from '../types/adr.js';

function main() {
  const adrDirArg = process.argv[2] || './docs/adr';
  let resolvedDir = adrDirArg;
  
  if (!path.isAbsolute(adrDirArg)) {
    resolvedDir = path.join(process.cwd(), adrDirArg);
  }

  if (!fs.existsSync(resolvedDir)) {
    console.error(chalk.red(`❌ Error: ADR directory not found at ${resolvedDir}`));
    process.exit(1);
  }

  console.log(chalk.cyan(`🔍 Linting ADRs in ${resolvedDir}...`));

  const files = glob.sync("**/*.{md,markdown}", { cwd: resolvedDir, absolute: true });
  const parsedADRs: ParsedADR[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    try {
      const baseNameMatch = path.basename(file).match(/^(\d+)/);
      let fallbackId = path.basename(file).replace(/\.mdx?$/, '');
      if (baseNameMatch) {
        fallbackId = `ADR-${baseNameMatch[1]}`;
      }
      parsedADRs.push(parseADRContent(content, fallbackId));
    } catch (e) {
      console.error(chalk.yellow(`⚠️ Failed to parse ${file}`));
    }
  }

  if (parsedADRs.length === 0) {
    console.warn(chalk.yellow(`⚠️ No ADRs found in ${resolvedDir}`));
    process.exit(0);
  }

  const { validationResult } = validateAndComputeDAG(parsedADRs);

  if (!validationResult.isValid) {
    console.error(chalk.red(`\n❌ Architecture DAG validation failed.`));
    
    if (validationResult.hasCycle && validationResult.cyclePath) {
      console.error(chalk.red(`   Circular Dependency Detected!`));
      console.error(chalk.yellow(`   Cycle Path: ${validationResult.cyclePath.join(' -> ')}`));
    }
    
    if (validationResult.missingDependencies.length > 0) {
      console.error(chalk.red(`   Broken Links Detected (Missing Dependencies):`));
      validationResult.missingDependencies.forEach(m => {
        console.error(chalk.yellow(`   - ${m.adrId} depends on missing ${m.missingId}`));
      });
    }
    
    process.exit(1);
  }

  const rootNodes = parsedADRs.filter(adr => !adr.frontmatter.depends_on || adr.frontmatter.depends_on.length === 0);

  console.log(chalk.green(`\n✅ Architecture DAG validated successfully.`));
  console.log(chalk.green(`   - Total ADRs: ${parsedADRs.length}`));
  console.log(chalk.green(`   - Root Decisions: ${rootNodes.length}`));
  console.log(chalk.green(`   - Zero Cycles: Verified`));
  
  process.exit(0);
}

main();
