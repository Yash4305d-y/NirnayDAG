import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchGitHubADRs } from '../src/utils/githubLoader.js';

describe('GitHub ADR Loader - Token Leak & Rate Limit Defense', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fetches file contents strictly via api.github.com with Accept: application/vnd.github.raw and NEVER sends token to raw.githubusercontent.com', async () => {
    const requestedUrls: string[] = [];
    const requestedHeaders: Array<Record<string, string>> = [];

    global.fetch = vi.fn().mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      requestedUrls.push(urlStr);
      const headers = (init?.headers || {}) as Record<string, string>;
      requestedHeaders.push(headers);

      // Verify that no request ever targets raw.githubusercontent.com
      const parsed = new URL(urlStr);
      expect(parsed.hostname).toBe('api.github.com');
      expect(parsed.hostname).not.toBe('raw.githubusercontent.com');

      // Directory contents listing mock
      if (urlStr.includes('/contents/docs/adr?ref=')) {
        expect(headers['Authorization']).toBe('Bearer secret-token-xyz');
        expect(headers['Accept']).toBe('application/vnd.github.v3+json');

        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          json: async () => [
            {
              name: '0001-init.md',
              path: 'docs/adr/0001-init.md',
              type: 'file',
              download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/docs/adr/0001-init.md',
            },
            {
              name: '0002-cache.md',
              path: 'docs/adr/0002-cache.md',
              type: 'file',
              download_url: 'https://raw.githubusercontent.com/test-owner/test-repo/main/docs/adr/0002-cache.md',
            },
          ],
        } as unknown as Response;
      }

      // Individual file fetch mock via api.github.com
      if (urlStr.includes('/contents/docs/adr/0001-init.md')) {
        expect(headers['Authorization']).toBe('Bearer secret-token-xyz');
        expect(headers['Accept']).toBe('application/vnd.github.raw');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: async () => '# ADR 1 Initial Setup',
        } as unknown as Response;
      }

      if (urlStr.includes('/contents/docs/adr/0002-cache.md')) {
        expect(headers['Authorization']).toBe('Bearer secret-token-xyz');
        expect(headers['Accept']).toBe('application/vnd.github.raw');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          text: async () => '# ADR 2 Cache Layer',
        } as unknown as Response;
      }

      throw new Error(`Unexpected URL in mock: ${urlStr}`);
    });

    const result = await fetchGitHubADRs({
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
      path: 'docs/adr',
      token: 'secret-token-xyz',
    });

    expect(result.errors).toEqual([]);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].content).toContain('# ADR 1 Initial Setup');
    expect(result.files[1].content).toContain('# ADR 2 Cache Layer');

    // Confirm that Authorization was NEVER dispatched to raw.githubusercontent.com
    for (const u of requestedUrls) {
      expect(u).not.toContain('raw.githubusercontent.com');
      expect(new URL(u).hostname).toBe('api.github.com');
    }
  });

  it('detects GitHub API rate limit (HTTP 403 with x-ratelimit-remaining: 0) and surfaces clear reset error message', async () => {
    const resetTimestamp = 1750000000;
    const expectedResetDate = new Date(resetTimestamp * 1000).toISOString();

    const rateLimitHeaders = new Headers({
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(resetTimestamp),
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'rate limit exceeded',
      headers: rateLimitHeaders,
    } as unknown as Response);

    const result = await fetchGitHubADRs({
      owner: 'acme-corp',
      repo: 'architecture',
      path: 'adrs',
    });

    expect(result.files).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('GitHub API rate limit exceeded');
    expect(result.errors[0]).toContain(expectedResetDate);
    expect(result.errors[0]).toContain('Please provide a GitHub Personal Access Token');
  });

  it('handles bad credentials (HTTP 401) with explicit error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: new Headers(),
    } as unknown as Response);

    const result = await fetchGitHubADRs({
      owner: 'acme-corp',
      repo: 'architecture',
      token: 'invalid-token',
    });

    expect(result.files).toEqual([]);
    expect(result.errors[0]).toContain('Bad credentials: The provided GitHub token is invalid (401)');
  });

  it('handles missing repository or path (HTTP 404) with clear message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
    } as unknown as Response);

    const result = await fetchGitHubADRs({
      owner: 'acme-corp',
      repo: 'non-existent-repo',
      path: 'docs/adr',
    });

    expect(result.files).toEqual([]);
    expect(result.errors[0]).toContain('Repository or path not found (404): acme-corp/non-existent-repo/docs/adr');
  });
});
