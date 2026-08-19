import yaml from 'js-yaml';
import type { NirnayADR, DecisionStatus } from '../core/types.js';

interface ADRFrontmatter {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  timestamp: string;
  dependencies?: string[];
  supersedes?: string;
}

export function parseADRMarkdown(fileContent: string): NirnayADR {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid ADR format: Missing YAML frontmatter headers.');
  }

  const rawYaml = match[1];
  const markdownBody = match[2];
  const metadata = yaml.load(rawYaml) as ADRFrontmatter;

  const context = extractSection(markdownBody, 'Context') || 'No context provided.';
  const decision = extractSection(markdownBody, 'Decision') || 'No decision documented.';

  const consequencesRaw = extractSection(markdownBody, 'Consequences') || '';

  const extractListMultiple = (content: string, subheaders: string[]): string[] => {
    for (const subheader of subheaders) {
      const regex = new RegExp(`### ${subheader}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\n### |$)`, 'i');
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
