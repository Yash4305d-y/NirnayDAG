import fs from 'fs-extra';
import path from 'path';
import { getGoverningDecisionsForFiles, normalizeRepoPath, type FileGoverningResult } from '../core/affects.js';
import type { DAGEngine } from '../core/dagEngine.js';
import type { NirnayADR } from '../core/types.js';

function isAbsoluteAnyPlatform(rawPath: string): boolean {
  return (
    path.isAbsolute(rawPath) ||
    rawPath.startsWith('/') ||
    rawPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(rawPath)
  );
}

/**
 * Validates that every input path is a safe, repo-relative path without
 * absolute prefixes, `..` traversal, out-of-repo resolution, or symlinks.
 * Never reads file contents.
 */
export function validateSafeRepoPaths(rawPaths: unknown, repoRoot: string = process.cwd()): string[] {
  if (!Array.isArray(rawPaths)) {
    throw new Error('Invalid "paths" argument: expected an array of repo-relative file paths.');
  }

  const resolvedRoot = path.resolve(repoRoot);
  const normalized: string[] = [];

  for (const raw of rawPaths) {
    if (typeof raw !== 'string' || raw.trim() === '') {
      throw new Error('Invalid path entry: expected a non-empty string.');
    }
    const trimmed = raw.trim();
    if (trimmed.includes('\0')) {
      throw new Error(`Invalid path "${trimmed}": null bytes are not allowed.`);
    }
    if (isAbsoluteAnyPlatform(trimmed)) {
      throw new Error(`Rejected absolute path "${trimmed}": only repo-relative paths are allowed.`);
    }
    const segments = trimmed.split(/[\\/]/);
    if (segments.includes('..')) {
      throw new Error(`Rejected path "${trimmed}": ".." traversal segments are not allowed.`);
    }

    const resolvedTarget = path.resolve(resolvedRoot, trimmed);
    const rel = path.relative(resolvedRoot, resolvedTarget);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error(`Rejected path "${trimmed}": resolves outside repository root.`);
    }

    // Check each existing segment via lstatSync without following symlinks
    const relSegments = rel ? rel.split(path.sep).filter(Boolean) : [];
    let current = resolvedRoot;
    for (const seg of relSegments) {
      current = path.join(current, seg);
      try {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) {
          throw new Error(`Rejected path "${trimmed}": symlinks are not followed.`);
        }
      } catch (err: any) {
        if (err?.code === 'ENOENT') {
          break;
        }
        throw err;
      }
    }

    normalized.push(normalizeRepoPath(rel));
  }

  return normalized;
}

export function getAdrsForFiles(
  rawPaths: unknown,
  adrs: NirnayADR[],
  engine: DAGEngine,
  repoRoot: string = process.cwd()
): { results: FileGoverningResult[] } {
  const safePaths = validateSafeRepoPaths(rawPaths, repoRoot);
  const results = getGoverningDecisionsForFiles(safePaths, adrs, engine);
  return { results };
}
