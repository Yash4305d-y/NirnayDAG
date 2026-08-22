import { spawnSync, spawn } from 'child_process';
import readline from 'readline';
import chalk from 'chalk';

console.log(chalk.bold.blue('🚀 Welcome to the NirnayDAG Interactive Demo!\n'));

console.log(chalk.cyan('Step 1: Validating docs/adr/ ...'));
spawnSync('npx', ['tsx', 'src/cli/index.ts', 'validate', './docs/adr'], { stdio: 'inherit' });

console.log(chalk.cyan('\nStep 2: Calculating Blast Radius for ADR-0001 ...'));
spawnSync('npx', ['tsx', 'src/cli/index.ts', 'blast', 'ADR-0001', './docs/adr'], { stdio: 'inherit' });

console.log(chalk.cyan('\nStep 3: Demonstrating Cycle Tripwire on sample-adrs ...'));
spawnSync('npx', ['tsx', 'src/cli/index.ts', 'validate', './sample-adrs'], { stdio: 'inherit' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(chalk.yellow('\nStep 4: Do you want to launch the interactive Web Canvas? (y/n) '), (answer) => {
  if (answer.toLowerCase().startsWith('y')) {
    console.log(chalk.cyan('\nLaunching NirnayDAG Web UI...'));
    const isWin = process.platform === 'win32';
    spawn(isWin ? 'npx.cmd' : 'npx', ['tsx', 'src/cli/index.ts', 'serve', './docs/adr', '--open'], { stdio: 'inherit', shell: true });
  } else {
    console.log(chalk.green('\nDemo complete. Try running the CLI yourself!'));
  }
  rl.close();
});
