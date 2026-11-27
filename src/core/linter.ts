import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import { compileAffectsMatcher, normalizeRepoPath } from './affects.js';
import type { DAGEngine } from './dagEngine.js';
import type { NirnayADR } from './types.js';

export type LintRuleId =
  | 'accepted-depends-on-deprecated'
  | 'superseded-without-successor'
  | 'broken-supersedes'
  | 'orphan'
  | 'affects-no-match'
  | 'deprecated-governs-code';

export interface LintOptions {
  repoFiles?: string[];
  repoRoot?: string;
}

export type LintSeverity = 'error' | 'warn' | 'info';

export type LintRuleConfigValue =
  | boolean
  | 'off'
  | LintSeverity
  | { enabled?: boolean; severity?: LintSeverity };

export interface LintConfig {
  rules?: Partial<Record<LintRuleId, LintRuleConfigValue>>;
}

export interface LintFinding {
  ruleId: LintRuleId;
  severity: LintSeverity;
  message: string;
  files: string[];
  nodeId: string;
}

export interface LintSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byRule: Record<LintRuleId, number>;
}

export interface LintResult {
  findings: LintFinding[];
  hasErrors: boolean;
  summary: LintSummary;
  appliedConfig: Record<LintRuleId, { enabled: boolean; severity: LintSeverity }>;
}

export const DEFAULT_LINT_RULES: Record<LintRuleId, { enabled: boolean; severity: LintSeverity }> = {
  'accepted-depends-on-deprecated': { enabled: true, severity: 'error' },
  'superseded-without-successor': { enabled: true, severity: 'warn' },
  'broken-supersedes': { enabled: true, severity: 'error' },
  orphan: { enabled: true, severity: 'info' },
  'affects-no-match': { enabled: true, severity: 'warn' },
  'deprecated-governs-code': { enabled: true, severity: 'warn' },
};

function resolveRuleSettings(
  config?: LintConfig
): Record<LintRuleId, { enabled: boolean; severity: LintSeverity }> {
  const resolved: Record<LintRuleId, { enabled: boolean; severity: LintSeverity }> = {
    'accepted-depends-on-deprecated': { ...DEFAULT_LINT_RULES['accepted-depends-on-deprecated'] },
    'superseded-without-successor': { ...DEFAULT_LINT_RULES['superseded-without-successor'] },
    'broken-supersedes': { ...DEFAULT_LINT_RULES['broken-supersedes'] },
    orphan: { ...DEFAULT_LINT_RULES.orphan },
    'affects-no-match': { ...DEFAULT_LINT_RULES['affects-no-match'] },
    'deprecated-governs-code': { ...DEFAULT_LINT_RULES['deprecated-governs-code'] },
  };

  if (!config?.rules) return resolved;

  for (const ruleId of Object.keys(resolved) as LintRuleId[]) {
    const raw = config.rules[ruleId];
    if (raw === undefined) continue;

    if (raw === false || raw === 'off') {
      resolved[ruleId].enabled = false;
    } else if (raw === true) {
      resolved[ruleId].enabled = true;
    } else if (raw === 'error' || raw === 'warn' || raw === 'info') {
      resolved[ruleId].enabled = true;
      resolved[ruleId].severity = raw;
    } else if (typeof raw === 'object' && raw !== null) {
      if (raw.enabled !== undefined) {
        resolved[ruleId].enabled = raw.enabled;
      }
      if (raw.severity && ['error', 'warn', 'info'].includes(raw.severity)) {
        resolved[ruleId].severity = raw.severity;
      }
    }
  }

  // `orphan` is strictly info-only and never fails CI.
  resolved.orphan.severity = 'info';

  return resolved;
}

/**
 * Loads `.nirnayrc.json` from targetDir or cwd if present.
 */
export async function loadNirnayConfig(targetDir?: string): Promise<LintConfig> {
  const candidates: string[] = [];
  if (targetDir) {
    const absTarget = path.resolve(targetDir);
    candidates.push(path.join(absTarget, '.nirnayrc.json'));
    candidates.push(path.join(path.dirname(absTarget), '.nirnayrc.json'));
  }
  candidates.push(path.join(process.cwd(), '.nirnayrc.json'));

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) {
      try {
        const parsed = await fs.readJson(candidate);
        if (parsed && typeof parsed === 'object') {
          return parsed as LintConfig;
        }
      } catch {
        // Ignore malformed config and fall back to defaults
      }
    }
  }
  return {};
}

function getFileLabel(adr: NirnayADR): string {
  return adr.filePath || `${adr.id}.md`;
}

function getSupersedesTargets(adr: NirnayADR): string[] {
  if (adr.supersedesList && adr.supersedesList.length > 0) {
    return adr.supersedesList;
  }
  return adr.supersedes ? [adr.supersedes] : [];
}

function walkRepoFiles(rootDir: string): string[] {
  const results: string[] = [];
  const walk = (currentDir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        results.push(normalizeRepoPath(path.relative(rootDir, fullPath)));
      }
    }
  };
  walk(rootDir);
  return results;
}

/**
 * Lists repo-relative file paths using `git ls-files`, falling back to a
 * filesystem walk that ignores `node_modules` and `.git`.
 */
export function listRepoFiles(repoRoot: string = process.cwd()): string[] {
  const resolvedRoot = path.resolve(repoRoot);
  try {
    const out = execFileSync('git', ['ls-files', '-z'], {
      cwd: resolvedRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out
      .split('\0')
      .map((f) => normalizeRepoPath(f))
      .filter(Boolean);
  } catch {
    return walkRepoFiles(resolvedRoot);
  }
}

/**
 * Runs all configured ADR lint rules against the parsed ADRs and DAG.
 * Rules that depend on decision status skip nodes whose status is `'default'`.
 */
export function lintArchitecture(
  adrs: NirnayADR[],
  engine: DAGEngine,
  config?: LintConfig,
  options?: LintOptions
): LintResult {
  const rules = resolveRuleSettings(config);
  const findings: LintFinding[] = [];

  const needsRepoFiles =
    (rules['affects-no-match'].enabled || rules['deprecated-governs-code'].enabled) &&
    adrs.some((a) => Array.isArray(a.affects) && a.affects.length > 0);

  const repoFiles = needsRepoFiles
    ? (options?.repoFiles
        ? options.repoFiles.map((f) => normalizeRepoPath(f))
        : listRepoFiles(options?.repoRoot))
    : [];

  const adrMap = new Map<string, NirnayADR>();
  for (const adr of adrs) {
    if (!adrMap.has(adr.id)) {
      adrMap.set(adr.id, adr);
    }
  }

  // Build reverse map of "who supersedes X"
  const supersededByOthers = new Map<string, string[]>();
  for (const adr of adrs) {
    for (const targetId of getSupersedesTargets(adr)) {
      const list = supersededByOthers.get(targetId) || [];
      list.push(adr.id);
      supersededByOthers.set(targetId, list);
    }
  }

  for (const adr of adrs) {
    const fileLabel = getFileLabel(adr);
    const isDefaultStatus = adr.statusSource === 'default';

    // 1. accepted-depends-on-deprecated
    if (rules['accepted-depends-on-deprecated'].enabled) {
      if (!isDefaultStatus && adr.status === 'accepted') {
        for (const depId of adr.dependencies) {
          const target = adrMap.get(depId);
          if (!target || target.statusSource === 'default') continue;
          if (target.status === 'deprecated' || target.status === 'superseded') {
            const files = Array.from(new Set([fileLabel, getFileLabel(target)]));
            findings.push({
              ruleId: 'accepted-depends-on-deprecated',
              severity: rules['accepted-depends-on-deprecated'].severity,
              message: `Accepted decision ${adr.id} has a hard dependency on ${target.status} decision ${target.id}.`,
              files,
              nodeId: adr.id,
            });
          }
        }
      }
    }

    // 2. superseded-without-successor
    if (rules['superseded-without-successor'].enabled) {
      if (!isDefaultStatus && adr.status === 'superseded') {
        const hasSupersededBy = (adr.supersededBy || []).length > 0;
        const hasIncomingSupersedes = (supersededByOthers.get(adr.id) || []).length > 0;
        if (!hasSupersededBy && !hasIncomingSupersedes) {
          findings.push({
            ruleId: 'superseded-without-successor',
            severity: rules['superseded-without-successor'].severity,
            message: `Decision ${adr.id} is marked superseded but no decision declares it superseded-by or supersedes it.`,
            files: [fileLabel],
            nodeId: adr.id,
          });
        }
      }
    }

    // 3. broken-supersedes
    if (rules['broken-supersedes'].enabled) {
      for (const targetId of getSupersedesTargets(adr)) {
        if (!adrMap.has(targetId)) {
          findings.push({
            ruleId: 'broken-supersedes',
            severity: rules['broken-supersedes'].severity,
            message: `Decision ${adr.id} declares supersedes target "${targetId}", which does not exist.`,
            files: [fileLabel],
            nodeId: adr.id,
          });
        }
      }
      for (const successorId of adr.supersededBy || []) {
        if (!adrMap.has(successorId)) {
          findings.push({
            ruleId: 'broken-supersedes',
            severity: rules['broken-supersedes'].severity,
            message: `Decision ${adr.id} declares superseded-by target "${successorId}", which does not exist.`,
            files: [fileLabel],
            nodeId: adr.id,
          });
        }
      }
    }

    // 4. orphan
    if (rules.orphan.enabled) {
      const hardDeps = engine.getDirectDependencies(adr.id, { includeSoft: false });
      const hardDependents = engine.getDirectDependents(adr.id, { includeSoft: false });
      const allDeps = engine.getDirectDependencies(adr.id, { includeSoft: true });
      const allDependents = engine.getDirectDependents(adr.id, { includeSoft: true });

      const hasAnyEdge =
        hardDeps.length > 0 ||
        hardDependents.length > 0 ||
        allDeps.length > 0 ||
        allDependents.length > 0;

      if (!hasAnyEdge) {
        findings.push({
          ruleId: 'orphan',
          severity: 'info',
          message: `Decision ${adr.id} has no incoming or outgoing edges (orphan).`,
          files: [fileLabel],
          nodeId: adr.id,
        });
      }
    }

    const affectsGlobs = adr.affects || [];
    if (affectsGlobs.length > 0) {
      let hasAnyMatchedFile = false;

      for (const globPattern of affectsGlobs) {
        const matcher = compileAffectsMatcher(globPattern);
        const matches = repoFiles.some((f) => matcher(f));
        if (matches) {
          hasAnyMatchedFile = true;
        } else if (rules['affects-no-match'].enabled) {
          findings.push({
            ruleId: 'affects-no-match',
            severity: rules['affects-no-match'].severity,
            message: `Decision ${adr.id} affects glob "${globPattern}" matches no files in the repository.`,
            files: [fileLabel],
            nodeId: adr.id,
          });
        }
      }

      if (
        rules['deprecated-governs-code'].enabled &&
        !isDefaultStatus &&
        (adr.status === 'deprecated' || adr.status === 'superseded') &&
        hasAnyMatchedFile
      ) {
        findings.push({
          ruleId: 'deprecated-governs-code',
          severity: rules['deprecated-governs-code'].severity,
          message: `${adr.status === 'deprecated' ? 'Deprecated' : 'Superseded'} decision ${adr.id} still governs existing files via affects.`,
          files: [fileLabel],
          nodeId: adr.id,
        });
      }
    }
  }

  const byRule: Record<LintRuleId, number> = {
    'accepted-depends-on-deprecated': 0,
    'superseded-without-successor': 0,
    'broken-supersedes': 0,
    orphan: 0,
    'affects-no-match': 0,
    'deprecated-governs-code': 0,
  };

  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const f of findings) {
    byRule[f.ruleId]++;
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warn') warnings++;
    else infos++;
  }

  return {
    findings,
    hasErrors: errors > 0,
    summary: {
      total: findings.length,
      errors,
      warnings,
      infos,
      byRule,
    },
    appliedConfig: rules,
  };
}
