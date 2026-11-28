import picomatch from 'picomatch';
import type { DAGEngine } from './dagEngine.js';
import type { DecisionStatus, NirnayADR, StatusSource } from './types.js';

export interface AncestorDecision {
  id: string;
  title: string;
  status: DecisionStatus;
  statusSource: StatusSource;
}

export interface GoverningDecision {
  id: string;
  title: string;
  status: DecisionStatus;
  statusSource: StatusSource;
  matchingGlob: string;
  isDeprecatedOrSuperseded: boolean;
  ancestors: AncestorDecision[];
}

export interface FileGoverningResult {
  file: string;
  decisions: GoverningDecision[];
}

/**
 * Normalizes a repo-relative file path to POSIX forward slashes without leading `./` or `/`.
 */
export function normalizeRepoPath(filePath: string): string {
  return filePath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

/**
 * Compiles a repo-root-relative `affects:` glob using `picomatch`.
 *
 * Case sensitivity: uses `nocase: false` (case-sensitive POSIX matching) so glob
 * evaluation is deterministic across Linux CI, macOS, and Windows workspaces, while
 * `dot: true` allows matching dotfiles (e.g. `.github/**`) when explicitly targeted.
 */
export function compileAffectsMatcher(globPattern: string): (filePath: string) => boolean {
  return picomatch(normalizeRepoPath(globPattern), { dot: true, nocase: false });
}

function getHardAncestors(
  adrId: string,
  adrMap: Map<string, NirnayADR>,
  engine: DAGEngine
): AncestorDecision[] {
  const visited = new Set<string>([adrId]);
  const queue: string[] = [adrId];
  const ancestors: AncestorDecision[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const deps = engine.getDirectDependencies(currentId, { includeSoft: false });
    for (const depId of deps) {
      if (visited.has(depId)) continue;
      visited.add(depId);
      const depAdr = adrMap.get(depId);
      if (depAdr) {
        ancestors.push({
          id: depAdr.id,
          title: depAdr.title,
          status: depAdr.status,
          statusSource: depAdr.statusSource ?? 'default',
        });
      }
      queue.push(depId);
    }
  }

  return ancestors;
}

/**
 * Resolves governing architectural decisions and their upstream hard-dependency
 * ancestors for each repo-relative file path.
 */
export function getGoverningDecisionsForFiles(
  filePaths: string[],
  adrs: NirnayADR[],
  engine: DAGEngine
): FileGoverningResult[] {
  const adrMap = new Map<string, NirnayADR>();
  for (const adr of adrs) {
    if (!adrMap.has(adr.id)) {
      adrMap.set(adr.id, adr);
    }
  }

  const compiledAdrs = adrs
    .filter((adr) => Array.isArray(adr.affects) && adr.affects.length > 0)
    .map((adr) => ({
      adr,
      matchers: (adr.affects as string[]).map((pattern) => ({
        pattern,
        match: compileAffectsMatcher(pattern),
      })),
    }));

  const ancestorCache = new Map<string, AncestorDecision[]>();
  const getAncestorsCached = (adrId: string): AncestorDecision[] => {
    let cached = ancestorCache.get(adrId);
    if (!cached) {
      cached = getHardAncestors(adrId, adrMap, engine);
      ancestorCache.set(adrId, cached);
    }
    return cached;
  };

  return filePaths.map((rawPath) => {
    const file = normalizeRepoPath(rawPath);
    const decisions: GoverningDecision[] = [];

    for (const { adr, matchers } of compiledAdrs) {
      const matched = matchers.find((m) => m.match(file));
      if (!matched) continue;

      const statusSource = adr.statusSource ?? 'default';
      const isDeprecatedOrSuperseded =
        adr.status === 'deprecated' || adr.status === 'superseded';

      decisions.push({
        id: adr.id,
        title: adr.title,
        status: adr.status,
        statusSource,
        matchingGlob: matched.pattern,
        isDeprecatedOrSuperseded,
        ancestors: getAncestorsCached(adr.id),
      });
    }

    return { file, decisions };
  });
}
