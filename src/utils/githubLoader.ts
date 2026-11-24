export interface GitHubRepoConfig {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token?: string;
}

export function checkRateLimit(response: Response): void {
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');
  const isRateLimited =
    response.status === 429 ||
    (response.status === 403 &&
      (remaining === '0' || response.statusText.toLowerCase().includes('rate limit')));

  if (isRateLimited) {
    let resetMsg = '';
    if (reset && !isNaN(Number(reset))) {
      const resetDate = new Date(Number(reset) * 1000);
      resetMsg = ` Resets at ${resetDate.toISOString()}.`;
    }
    throw new Error(
      `GitHub API rate limit exceeded.${resetMsg} Please provide a GitHub Personal Access Token to increase your rate limit.`
    );
  }
}

export async function fetchGitHubADRs(
  config: GitHubRepoConfig
): Promise<{ files: Array<{ name: string; content: string }>; errors: string[] }> {
  const { owner, repo, branch = 'main', path = '', token } = config;
  const errors: string[] = [];
  const files: Array<{ name: string; content: string }> = [];

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Clean up path
  const urlPath = path.replace(/^\/|\/$/g, '');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${urlPath}?ref=${encodeURIComponent(branch)}`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      checkRateLimit(response);
      if (response.status === 404) {
        throw new Error(`Repository or path not found (404): ${owner}/${repo}/${urlPath}`);
      } else if (response.status === 401) {
        throw new Error('Bad credentials: The provided GitHub token is invalid (401).');
      } else if (response.status === 403) {
        throw new Error(`Access forbidden (403): Check permissions for ${owner}/${repo}`);
      } else {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    let items: any[] = [];

    if (Array.isArray(data)) {
      items = data;
    } else if (typeof data === 'object' && data !== null) {
      items = [data];
    }

    // Filter for markdown files
    const mdItems = items.filter(
      (item) =>
        item.type === 'file' &&
        (item.name.toLowerCase().endsWith('.md') || item.name.toLowerCase().endsWith('.markdown'))
    );

    // Fetch file contents through GitHub API (api.github.com) with Accept: application/vnd.github.raw
    // NEVER send Authorization to raw.githubusercontent.com
    await Promise.all(
      mdItems.map(async (item) => {
        try {
          const itemPath = item.path || (urlPath ? `${urlPath}/${item.name}` : item.name);
          const fileApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${itemPath}?ref=${encodeURIComponent(branch)}`;

          const fileHeaders: Record<string, string> = {
            Accept: 'application/vnd.github.raw',
          };
          if (token) {
            fileHeaders['Authorization'] = `Bearer ${token}`;
          }

          const contentResponse = await fetch(fileApiUrl, { headers: fileHeaders });
          if (!contentResponse.ok) {
            checkRateLimit(contentResponse);
            // Fallback for base64 if available in item
            if (item.content) {
              const decoded =
                typeof Buffer !== 'undefined'
                  ? Buffer.from(item.content, item.encoding || 'base64').toString('utf-8')
                  : atob(item.content);
              files.push({ name: item.name, content: decoded });
              return;
            }
            errors.push(
              `Failed to download ${item.name}: ${contentResponse.status} ${contentResponse.statusText}`
            );
            return;
          }

          const content = await contentResponse.text();
          files.push({ name: item.name, content });
        } catch (fileErr: any) {
          errors.push(`Error downloading ${item.name}: ${fileErr.message}`);
        }
      })
    );
  } catch (err: any) {
    errors.push(err.message || String(err));
  }

  return { files, errors };
}
