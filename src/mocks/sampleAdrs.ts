import { parseADRMarkdown } from '../parser/adrParser.js';
import type { NirnayADR } from '../core/types.js';

// Use Vite's glob import to get all markdown files in the adrs directory as raw strings
const adrFiles = import.meta.glob('../../adrs/*.md', { query: '?raw', import: 'default', eager: true });

export const SAMPLE_ADRS: NirnayADR[] = Object.values(adrFiles).map((fileContent) => 
  parseADRMarkdown(fileContent as string)
);
