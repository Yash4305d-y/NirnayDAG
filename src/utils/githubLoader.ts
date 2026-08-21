export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token?: string;
}

export async function fetchGitHubADRs(config: GitHubRepoConfig): Promise<{ files: Array<{ name: string; content: string }>; errors: string[] }> {
  const { owner, repo, branch = 'main', path = '', token } = config;
  const errors: string[] = [];
  const files: Array<{ name: string; content: string }> = [];

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Clean up path
  const urlPath = path.replace(/^\/|\/$/g, '');
  // Build URL with ref query parameter for branch
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${urlPath}?ref=${branch}`;

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded or forbidden (403).');
      } else if (response.status === 404) {
        throw new Error(`Repository or path not found (404): ${owner}/${repo}/${urlPath}`);
      } else if (response.status === 401) {
        throw new Error('Bad credentials: The provided GitHub token is invalid (401).');
      } else {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    let items: any[] = [];
    
    // If it's a directory, GitHub returns an array. If it's a file, it returns an object.
    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === 'object' && data !== null) {
      items = [data];
    }
    
    // Filter for markdown files
    const mdItems = items.filter(item => 
      item.type === 'file' && 
      (item.name.toLowerCase().endsWith('.md') || item.name.toLowerCase().endsWith('.markdown'))
    );
    
    // Fetch raw contents sequentially (or could be Promise.all to optimize)
    // We'll use Promise.all to fetch them in parallel.
    await Promise.all(mdItems.map(async (item) => {
      if (item.download_url) {
        try {
          // Fetch raw file
          // IMPORTANT: Need to be careful to pass the auth token for download urls too
          // Some download URLs (like on private repos) require it.
          const contentResponse = await fetch(item.download_url, { headers });
          if (!contentResponse.ok) {
            errors.push(`Failed to download ${item.name}: ${contentResponse.statusText}`);
            return;
          }
          const content = await contentResponse.text();
          files.push({ name: item.name, content });
        } catch (downloadErr: any) {
          errors.push(`Error downloading ${item.name}: ${downloadErr.message}`);
        }
      } else if (item.content) {
        // Fallback for when the file content is returned directly in base64
        try {
          const encoding = item.encoding || 'base64';
          let decodedContent = '';
          if (encoding === 'base64') {
            if (typeof Buffer !== 'undefined') {
              decodedContent = Buffer.from(item.content, 'base64').toString('utf-8');
            } else {
              decodedContent = atob(item.content);
            }
          } else {
            decodedContent = item.content;
          }
          files.push({ name: item.name, content: decodedContent });
        } catch (decodeErr: any) {
          errors.push(`Error decoding ${item.name}: ${decodeErr.message}`);
        }
      } else {
        errors.push(`No download URL or content found for ${item.name}`);
      }
    }));

  } catch (err: any) {
    errors.push(err.message || String(err));
  }

  return { files, errors };
}
