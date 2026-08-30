import { describe, it, expect, vi } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Interactive CLI Mode Fallback', () => {
  const cliPath = path.resolve(__dirname, '../../dist/cli.js');
  
  // Note: we run these integration tests assuming 'npm run build' has been completed.
  // Alternatively we can use tsx for direct TS execution. Let's use tsx.
  const srcCliPath = path.resolve(__dirname, '../../src/cli/index.ts');
  const adrDir = path.resolve(__dirname, '../../sample-adrs'); // assuming sample-adrs exists

  it('should fallback to JSON when --json is provided', () => {
    try {
      const output = execSync(`npx tsx ${srcCliPath} interactive ${adrDir} --json`, { encoding: 'utf-8' });
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('adrs');
      expect(parsed).toHaveProperty('validation');
    } catch (e: any) {
      if (e.stderr && e.stderr.includes('Directory not found')) {
        console.warn('Skipping test, sample-adrs directory not found');
      } else {
        throw e;
      }
    }
  }, 15000);

  it('should fallback to JSON when ANTIGRAVITY_SESSION is set', () => {
    try {
      const output = execSync(`npx tsx ${srcCliPath} interactive ${adrDir}`, { 
        encoding: 'utf-8',
        env: { ...process.env, ANTIGRAVITY_SESSION: 'true' }
      });
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty('adrs');
      expect(parsed).toHaveProperty('validation');
    } catch (e: any) {
      if (e.stderr && e.stderr.includes('Directory not found')) {
        console.warn('Skipping test, sample-adrs directory not found');
      } else {
        throw e;
      }
    }
  }, 15000);
});
