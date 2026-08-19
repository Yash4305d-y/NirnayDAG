import * as yaml from 'js-yaml';
import type { NirnayADR, DecisionStatus } from '../core/types';

interface ADRFrontmatter {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  timestamp: string;
  dependencies?: string[];
  supersedes?: string;
}

/**
 * Parses markdown files formatted with YAML frontmatter into strongly typed NirnayADRs
 */
export function parseADRMarkdown(fileContent: string): NirnayADR {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid ADR format: Missing YAML frontmatter headers.');
  }

  const rawYaml = match[1];
  const markdownBody = match[2];
  const metadata = yaml.load(rawYaml) as ADRFrontmatter;

  // Extract sections from markdown body using standard markdown headers
  const context = extractSection(markdownBody, 'Context') || 'No context provided.';
  const decision = extractSection(markdownBody, 'Decision') || 'No decision recorded.';
  
  const consequencesRaw = extractSection(markdownBody, 'Consequences') || '';
  const pros = extractBulletItems(consequencesRaw, 'Positive|Pros|Benefits');
  const cons = extractBulletItems(consequencesRaw, 'Negative|Cons|Trade-offs|Risks');

  return {
    id: metadata.id,
    title: metadata.title,
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

function extractSection(content: string, headerName: string): string | null {
  const regex = new RegExp(`##\\s*${headerName}[\\r\\n]+([\\s\\S]*?)(?=(##\\s*|$))`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractBulletItems(content: string, subHeaderPattern: string): string[] {
  const subSectionRegex = new RegExp(`###?\\s*(${subHeaderPattern})[\\r\\n]+([\\s\\S]*?)(?=(###?\\s*|$))`, 'i');
  const match = content.match(subSectionRegex);
  const targetText = match ? match[2] : content;

  return targetText
    .split(/[\r\n]+/)
    .filter((line) => /^\s*[-*+]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*+]\s+/, '').trim());
}
