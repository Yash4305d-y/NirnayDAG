import { parseADRMarkdown } from '../parser/adrParser.js';
import type { NirnayADR } from '../core/types.js';

export function parseGitHubUrl(input: string): { owner: string; repo: string; branch?: string; path?: string } {
  let cleanInput = input.trim().replace(/\/$/, '');
  
  if (cleanInput.startsWith('http')) {
    const url = new URL(cleanInput);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      let branch: string | undefined;
      let path: string | undefined;
      
      if (parts.length >= 4 && parts[2] === 'tree') {
        branch = parts[3];
        path = parts.slice(4).join('/');
      }
      return { owner, repo, branch, path };
    }
  } else {
    const parts = cleanInput.split('/').filter(Boolean);
    if (parts.length === 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  }
  
  throw new Error('Invalid GitHub URL or format. Use owner/repo or a full GitHub URL.');
}

export async function fetchAdrsFromGitHub(options: {
  repoUrl: string;
  branch?: string;
  path?: string;
  token?: string;
}): Promise<{ adrs: NirnayADR[]; repoName: string; errors: string[] }> {
  const parsed = parseGitHubUrl(options.repoUrl);
  
  const owner = parsed.owner;
  const repo = parsed.repo;
  const branch = options.branch || parsed.branch || 'main';
  const path = options.path || parsed.path || 'adrs';
  
  const repoName = `${owner}/${repo}`;
  const result: { adrs: NirnayADR[]; repoName: string; errors: string[] } = { adrs: [], repoName, errors: [] };
  
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  
  try {
    const res = await fetch(apiUrl, { headers });
    
    if (res.status === 404) {
      result.errors.push("Repository, branch, or folder path not found.");
      return result;
    }
    if (res.status === 403) {
      result.errors.push("GitHub API rate limit exceeded. Please provide a Personal Access Token (PAT).");
      return result;
    }
    if (!res.ok) {
      result.errors.push(`GitHub API returned ${res.status}: ${res.statusText}`);
      return result;
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) {
      result.errors.push("Target path is not a directory.");
      return result;
    }
    
    for (const item of data) {
      if (item.type === 'file' && (item.name.endsWith('.md') || item.name.endsWith('.markdown'))) {
        try {
          let fileContent = '';
          if (item.content) {
             // atob can throw if content is not properly encoded
             fileContent = decodeURIComponent(escape(atob(item.content)));
          } else if (item.download_url) {
             const rawRes = await fetch(item.download_url, { headers });
             if (!rawRes.ok) throw new Error(`Failed to fetch raw content from ${item.download_url}`);
             fileContent = await rawRes.text();
          }
          
          if (fileContent) {
            result.adrs.push(parseADRMarkdown(fileContent, item.name));
          }
        } catch (e: any) {
          result.errors.push(`Failed to parse ${item.name}: ${e.message}`);
        }
      }
    }
    
  } catch (e: any) {
    result.errors.push(`Network or parsing error: ${e.message}`);
  }
  
  return result;
}
