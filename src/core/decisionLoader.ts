import path from 'path';
import fs from 'fs-extra';
import glob from 'fast-glob';

export const DEFAULT_INCLUDE_GLOBS = ['**/*.{md,mdx}'];

export const DEFAULT_EXCLUDE_GLOBS = [
  '**/template*',
  '**/_template*',
  '**/*.template.md',
];

export interface NirnayConfig {
  version?: string;
  adrsDir?: string;
  include?: string[];
  exclude?: string[];
}

export interface ListDecisionFilesOptions {
  include?: string[];
  exclude?: string[];
  /** Base patterns used to discover all candidate markdown files for excluded reporting. */
  basePatterns?: string[];
  /** Skip reading .nirnayrc.json when explicit globs are supplied. */
  ignoreConfig?: boolean;
}

export interface DecisionFileListResult {
  included: string[];
  excluded: string[];
  all: string[];
}

function normalizeConfigPatterns(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

/**
 * Loads `.nirnayrc.json` from `targetDir` (falling back to `process.cwd()`).
 */
export async function loadNirnayConfig(targetDir: string): Promise<NirnayConfig> {
  const candidates = [path.join(targetDir, '.nirnayrc.json')];
  const cwdConfig = path.join(process.cwd(), '.nirnayrc.json');
  if (path.resolve(cwdConfig) !== path.resolve(candidates[0])) {
    candidates.push(cwdConfig);
  }

  for (const configPath of candidates) {
    if (await fs.pathExists(configPath)) {
      try {
        const raw = await fs.readJson(configPath);
        return {
          version: typeof raw.version === 'string' ? raw.version : undefined,
          adrsDir: typeof raw.adrsDir === 'string' ? raw.adrsDir : undefined,
          include: normalizeConfigPatterns(raw.include),
          exclude: Array.isArray(raw.exclude)
            ? raw.exclude.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            : undefined,
        };
      } catch {
        return {};
      }
    }
  }
  return {};
}

export function loadNirnayConfigSync(targetDir: string): NirnayConfig {
  const candidates = [path.join(targetDir, '.nirnayrc.json')];
  const cwdConfig = path.join(process.cwd(), '.nirnayrc.json');
  if (path.resolve(cwdConfig) !== path.resolve(candidates[0])) {
    candidates.push(cwdConfig);
  }

  for (const configPath of candidates) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readJsonSync(configPath);
        return {
          version: typeof raw.version === 'string' ? raw.version : undefined,
          adrsDir: typeof raw.adrsDir === 'string' ? raw.adrsDir : undefined,
          include: normalizeConfigPatterns(raw.include),
          exclude: Array.isArray(raw.exclude)
            ? raw.exclude.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            : undefined,
        };
      } catch {
        return {};
      }
    }
  }
  return {};
}

function resolveEffectiveGlobs(
  config: NirnayConfig,
  options?: ListDecisionFilesOptions
): { include: string[]; exclude: string[]; basePatterns: string[] } {
  const basePatterns =
    options?.basePatterns && options.basePatterns.length > 0
      ? options.basePatterns
      : DEFAULT_INCLUDE_GLOBS;

  const include =
    options?.include && options.include.length > 0
      ? options.include
      : config.include && config.include.length > 0
        ? config.include
        : basePatterns;

  const exclude =
    options?.exclude !== undefined
      ? options.exclude
      : config.exclude !== undefined
        ? config.exclude
        : DEFAULT_EXCLUDE_GLOBS;

  return { include, exclude, basePatterns };
}

/**
 * Lists decision files in `targetDir`, applying `include` and `exclude` globs
 * from options or `.nirnayrc.json` (defaulting to excluding template files).
 */
export async function listDecisionFiles(
  targetDir: string,
  options?: ListDecisionFilesOptions
): Promise<DecisionFileListResult> {
  if (!(await fs.pathExists(targetDir))) {
    return { included: [], excluded: [], all: [] };
  }

  const config = options?.ignoreConfig ? {} : await loadNirnayConfig(targetDir);
  const { include, exclude, basePatterns } = resolveEffectiveGlobs(config, options);

  const all = (
    await glob(basePatterns, {
      cwd: targetDir,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
    })
  ).sort();

  const included = (
    await glob(include, {
      cwd: targetDir,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
      ignore: exclude,
    })
  ).sort();

  const includedSet = new Set(included.map((p) => path.resolve(p)));
  const excluded = all.filter((p) => !includedSet.has(path.resolve(p)));

  return { included, excluded, all };
}

export function listDecisionFilesSync(
  targetDir: string,
  options?: ListDecisionFilesOptions
): DecisionFileListResult {
  if (!fs.existsSync(targetDir)) {
    return { included: [], excluded: [], all: [] };
  }

  const config = options?.ignoreConfig ? {} : loadNirnayConfigSync(targetDir);
  const { include, exclude, basePatterns } = resolveEffectiveGlobs(config, options);

  const all = glob
    .sync(basePatterns, {
      cwd: targetDir,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
    })
    .sort();

  const included = glob
    .sync(include, {
      cwd: targetDir,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
      ignore: exclude,
    })
    .sort();

  const includedSet = new Set(included.map((p) => path.resolve(p)));
  const excluded = all.filter((p) => !includedSet.has(path.resolve(p)));

  return { included, excluded, all };
}
