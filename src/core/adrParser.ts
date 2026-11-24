import * as yaml from 'js-yaml';
import type { ParsedADR, ADRFrontmatter, ADRStatus, ADRConsequences, NirnayADR, DecisionStatus } from './types.js';

function extractSection(content: string, headings: string[]): string {
  const headingsRe = headings.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\r?\\n)##\\s+(?:${headingsRe})[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+(?!#)|$)`, 'i');
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

  // Process Status with Aliases and Normalization
  let rawStatus = frontmatterData.status || frontmatterData.stage || frontmatterData.state || 'accepted';
  rawStatus = String(rawStatus).toLowerCase();
  
  let status: ADRStatus = 'accepted';
  if (['proposed', 'draft'].includes(rawStatus)) {
    status = 'proposed';
  } else if (['accepted', 'implemented', 'done', 'approved', 'active'].includes(rawStatus)) {
    status = 'accepted';
  } else if (['deprecated', 'obsolete', 'retired'].includes(rawStatus)) {
    status = 'deprecated';
  } else if (['superseded', 'replaced'].includes(rawStatus)) {
    status = 'superseded';
  }

  // Process Dependencies with Aliases
  let dependsOn: string[] = frontmatterData.depends_on || frontmatterData['depends-on'] || frontmatterData.dependencies || frontmatterData.requires || [];
  if (!Array.isArray(dependsOn)) {
    dependsOn = [dependsOn];
  }

  // Process Supersedes with Aliases
  let supersedes: string[] = frontmatterData.supersedes || frontmatterData.replaces || frontmatterData['superseded-by'] || [];
  if (!Array.isArray(supersedes)) {
    supersedes = [supersedes];
  }

  // Fallback: Infer dependencies from markdown body links if frontmatter is empty
  if (dependsOn.length === 0 && bodyContent) {
    const linkRegex = /(?:\[ADR-[\w-]+\]|\(\.\/[\w-]+[^)]*\))/g;
    const matches = bodyContent.match(linkRegex);
    if (matches) {
      matches.forEach(m => {
        // extract the actual ADR-XXXX or 000X from the match
        if (m.startsWith('[ADR-')) {
          dependsOn.push(m.substring(1, m.length - 1));
        } else if (m.startsWith('(./')) {
          const numMatch = m.match(/\(\.\/([^/.)]+)/);
          if (numMatch) {
            dependsOn.push(`ADR-${numMatch[1]}`);
          }
        }
      });
      // Deduplicate
      dependsOn = Array.from(new Set(dependsOn));
    }
  }

  const frontmatter: ADRFrontmatter = {
    id: id,
    title: title,
    status: status,
    date: frontmatterData.date || new Date().toISOString().split('T')[0],
    deciders: frontmatterData.deciders,
    tags: frontmatterData.tags,
    depends_on: dependsOn,
    supersedes: supersedes,
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

export function parseBatchADRs(files: Array<{ name: string; content: string; filePath?: string }>): ParsedADR[] {
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
      parsed.filePath = file.filePath ?? file.name;
      parsedADRs.push(parsed);
    } catch (e) {
      console.warn(`Error parsing ADR file ${file.name}:`, e);
    }
  }

  return parsedADRs;
}

interface ADRFrontmatterInput {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  timestamp: string;
  dependencies?: string[];
  supersedes?: string;
}

function extractMarkdownSection(content: string, headerName: string): string | null {
  const regex = new RegExp(`##\\s+${headerName}[\\r\\n]+([\\s\\S]*?)(?=(?:\\r?\\n##\\s+(?!#)|$))`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

export function parseADRMarkdown(fileContent: string, filename?: string): NirnayADR {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid ADR format: Missing YAML frontmatter headers.');
  }

  const rawYaml = match[1];
  const markdownBody = match[2];
  const metadata = yaml.load(rawYaml) as ADRFrontmatterInput;

  const context = extractMarkdownSection(markdownBody, 'Context') || 'No context provided.';
  const decision = extractMarkdownSection(markdownBody, 'Decision') || 'No decision documented.';

  const consequencesRaw = extractMarkdownSection(markdownBody, 'Consequences') || '';

  const extractListMultiple = (content: string, subheaders: string[]): string[] => {
    for (const subheader of subheaders) {
      const regex = new RegExp(`### ${subheader}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\r?\\n### |$)`, 'i');
      const match = content.match(regex);
      if (match) {
        return match[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.replace(/^- /, ''));
      }
    }
    return [];
  };

  const pros = extractListMultiple(consequencesRaw, ['Positive', 'Pros', 'Benefits']);
  const cons = extractListMultiple(consequencesRaw, ['Negative', 'Cons', 'Drawbacks']);

  const fallbackId = filename ? filename.replace(/\.(md|markdown)$/i, '') : `ADR-${Math.random().toString(36).substring(2, 8)}`;
  
  return {
    id: metadata.id || fallbackId,
    title: metadata.title || fallbackId,
    category: metadata.category || 'Infrastructure',
    status: metadata.status || 'proposed',
    timestamp: metadata.timestamp || new Date().toISOString().split('T')[0],
    dependencies: metadata.dependencies || [],
    supersedes: metadata.supersedes,
    context,
    decision,
    consequences: { pros, cons },
  };
}
