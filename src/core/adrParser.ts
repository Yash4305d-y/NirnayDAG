import * as yaml from 'js-yaml';
import { ParsedADR, ADRFrontmatter, ADRStatus, ADRConsequences } from '../types/adr.js';

function extractSection(content: string, headings: string[]): string {
  const headingsRe = headings.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\r?\\n)##[ \\t]+(?:${headingsRe})[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##[ \\t]|(?![\\s\\S]))`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseConsequences(text: string): ADRConsequences {
  const positive: string[] = [];
  const negative: string[] = [];
  
  const lines = text.split('\n');
  let currentMode: 'neutral' | 'positive' | 'negative' = 'neutral';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.match(/^###\s*(Positive|Pros|Good)/i)) {
      currentMode = 'positive';
      continue;
    }
    if (trimmed.match(/^###\s*(Negative|Cons|Bad)/i)) {
      currentMode = 'negative';
      continue;
    }
    
    const isList = trimmed.startsWith('-') || trimmed.startsWith('+') || trimmed.startsWith('*');
    if (isList) {
      const item = trimmed.substring(1).trim();
      if (trimmed.startsWith('+') || currentMode === 'positive') {
        positive.push(item);
      } else if (trimmed.startsWith('-') || currentMode === 'negative') {
        negative.push(item);
      } else {
        // Fallback for '*' or neutral state
        positive.push(item);
      }
    }
  }
  
  return { positive, negative };
}

export function parseADRContent(content: string, fallbackId?: string): ParsedADR {
  let frontmatterData: any = {};
  let bodyContent = content;

  // Extract YAML frontmatter
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const fmMatch = content.match(fmRegex);
  
  if (fmMatch) {
    try {
      const parsedYaml = yaml.load(fmMatch[1]);
      if (typeof parsedYaml === 'object' && parsedYaml !== null) {
        frontmatterData = parsedYaml;
      }
    } catch (e) {
      console.warn('Failed to parse YAML frontmatter:', e);
    }
    bodyContent = content.slice(fmMatch[0].length).trim();
  }

  // Extract title from first heading if not in frontmatter
  let title = frontmatterData.title;
  if (!title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    title = titleMatch ? titleMatch[1].trim() : 'Untitled ADR';
  }

  // Determine ID
  const id = frontmatterData.id || fallbackId || `ADR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const frontmatter: ADRFrontmatter = {
    id: id,
    title: title,
    status: (frontmatterData.status as ADRStatus) || 'proposed',
    date: frontmatterData.date || new Date().toISOString().split('T')[0],
    deciders: frontmatterData.deciders,
    tags: frontmatterData.tags,
    depends_on: frontmatterData.depends_on,
    supersedes: frontmatterData.supersedes,
    conflicts_with: frontmatterData.conflicts_with,
  };

  const context = extractSection(bodyContent, ['Context', 'Problem Statement']);
  const decision = extractSection(bodyContent, ['Decision', 'Resolution']);
  const consequencesText = extractSection(bodyContent, ['Consequences', 'Pros and Cons', 'Pros & Cons']);
  const consequences = parseConsequences(consequencesText);

  return {
    frontmatter,
    context,
    decision,
    consequences,
    rawContent: content
  };
}

export function parseBatchADRs(files: Array<{ name: string; content: string }>): ParsedADR[] {
  const parsedADRs: ParsedADR[] = [];

  for (const file of files) {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.mdx')) {
      continue;
    }

    try {
      // Create fallback ID from filename (e.g., 0001-record-architecture-decisions.md -> 0001)
      const baseNameMatch = file.name.match(/^(\d+)/);
      let fallbackId = file.name.replace(/\.mdx?$/, '');
      if (baseNameMatch) {
        fallbackId = `ADR-${baseNameMatch[1]}`;
      }

      const parsed = parseADRContent(file.content, fallbackId);
      parsedADRs.push(parsed);
    } catch (e) {
      console.warn(`Error parsing ADR file ${file.name}:`, e);
    }
  }

  return parsedADRs;
}
