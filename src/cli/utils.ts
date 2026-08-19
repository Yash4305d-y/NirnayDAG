import fs from 'fs/promises';
import path from 'path';
import { parseADRMarkdown } from '../parser/adrParser';
import type { NirnayADR } from '../core/types';

export async function loadADRs(dirPath: string): Promise<NirnayADR[]> {
  try {
    const files = await fs.readdir(dirPath);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const adrs: NirnayADR[] = [];
    for (const file of mdFiles) {
      const content = await fs.readFile(path.join(dirPath, file), 'utf-8');
      adrs.push(parseADRMarkdown(content));
    }
    return adrs;
  } catch (err) {
    return [];
  }
}
