import * as yaml from 'js-yaml';
import type {
  ParsedADR,
  ADRFrontmatter,
  ADRStatus,
  ADRConsequences,
  NirnayADR,
  DecisionStatus,
  ADREdgeRef,
  ClassifiedLink,
  LinkClassification,
} from './types.js';

function extractSection(content: string, headings: string[]): string {
  const headingsRe = headings.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(?:^|\\r?\\n)##\\s+(?:${headingsRe})[ \\t]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n##\\s+(?!#)|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseConsequences(text: string): ADRConsequences {
  const positive: string[] = [];
  const negative: string[] = [];
  
  const lines = text.split('\n');
  let currentMode: 'neutral' | 'positive' | 'negative' = 'neutral';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.match(/^###\s*(Positive|Pros|Good)/i)) {
      currentMode = 'positive';
      continue;
    }
    if (trimmed.match(/^###\s*(Negative|Cons|Bad)/i)) {
      currentMode = 'negative';
      continue;
    }
    
    const isList = trimmed.startsWith('-') || trimmed.startsWith('+') || trimmed.startsWith('*');
    if (isList) {
      const item = trimmed.substring(1).trim();
      if (trimmed.startsWith('+') || currentMode === 'positive') {
        positive.push(item);
      } else if (trimmed.startsWith('-') || currentMode === 'negative') {
        negative.push(item);
      } else {
        // Fallback for '*' or neutral state
        positive.push(item);
      }
    }
  }
  
  return { positive, negative };
}

export function parseADRContent(content: string, fallbackId?: string): ParsedADR {
  let frontmatterData: any = {};
  let bodyContent = content;

  // Extract YAML frontmatter
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const fmMatch = content.match(fmRegex);
  
  if (fmMatch) {
    try {
      const parsedYaml = yaml.load(fmMatch[1]);
      if (typeof parsedYaml === 'object' && parsedYaml !== null) {
        frontmatterData = parsedYaml;
      }
    } catch (e) {
      console.warn('Failed to parse YAML frontmatter:', e);
    }
    bodyContent = content.slice(fmMatch[0].length).trim();
  }

  // Extract title from first heading if not in frontmatter
  let title = frontmatterData.title;
  if (!title) {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    title = titleMatch ? titleMatch[1].trim() : 'Untitled ADR';
  }

  // Determine ID
  const id = frontmatterData.id || fallbackId || `ADR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // Process Status with Aliases and Normalization
  let rawStatus = frontmatterData.status || frontmatterData.stage || frontmatterData.state || 'accepted';
  rawStatus = String(rawStatus).toLowerCase();
  
  let status: ADRStatus = 'accepted';
  if (['proposed', 'draft'].includes(rawStatus)) {
    status = 'proposed';
  } else if (['accepted', 'implemented', 'done', 'approved', 'active'].includes(rawStatus)) {
    status = 'accepted';
  } else if (['deprecated', 'obsolete', 'retired'].includes(rawStatus)) {
    status = 'deprecated';
  } else if (['superseded', 'replaced'].includes(rawStatus)) {
    status = 'superseded';
  }

  // Process Dependencies with Aliases (Hard edges)
  let rawDependsOn: unknown = frontmatterData.depends_on || frontmatterData['depends-on'] || frontmatterData.dependencies || frontmatterData.requires || [];
  if (!Array.isArray(rawDependsOn)) {
    rawDependsOn = [rawDependsOn];
  }
  const dependsOn: string[] = Array.from(
    new Set((rawDependsOn as unknown[]).map((d) => String(d).trim()).filter(Boolean))
  );

  // Process Supersedes with Aliases (Hard edges)
  let rawSupersedes: unknown = frontmatterData.supersedes || frontmatterData.replaces || frontmatterData['superseded-by'] || [];
  if (!Array.isArray(rawSupersedes)) {
    rawSupersedes = [rawSupersedes];
  }
  const supersedesSet = new Set<string>(
    (rawSupersedes as unknown[]).map((s) => String(s).trim()).filter(Boolean)
  );

  const edges: ADREdgeRef[] = [];
  const hardTargets = new Set<string>();

  for (const depId of dependsOn) {
    hardTargets.add(depId);
    edges.push({
      targetId: depId,
      kind: 'hard',
      source: 'frontmatter:depends_on',
      rawText: `depends_on: ${depId}`,
    });
  }

  for (const supId of supersedesSet) {
    hardTargets.add(supId);
    edges.push({
      targetId: supId,
      kind: 'hard',
      source: 'frontmatter:supersedes',
      rawText: `supersedes: ${supId}`,
    });
  }

  // Explicit "Supersedes ADR-XXXX" status line in body (Hard edge)
  if (bodyContent) {
    const statusSupersedesRegex = /^\s*(?:[-*]\s*)?(Supersedes\s+(ADR-[\w-]+))\b/gim;
    let supMatch: RegExpExecArray | null;
    while ((supMatch = statusSupersedesRegex.exec(bodyContent)) !== null) {
      const targetId = supMatch[2];
      if (!supersedesSet.has(targetId)) {
        supersedesSet.add(targetId);
        hardTargets.add(targetId);
        edges.push({
          targetId,
          kind: 'hard',
          source: 'status:supersedes',
          rawText: supMatch[1].trim(),
        });
      }
    }
  }

  const supersedes = Array.from(supersedesSet);

  // Extract soft reference edges from markdown body links and ID tokens
  if (bodyContent) {
    const linkRegex = /(?:\[ADR-[\w-]+\]|\(\.\/[\w-]+[^)]*\))/gi;
    const matches = bodyContent.match(linkRegex);
    const seenSoft = new Set<string>();
    if (matches) {
      for (const m of matches) {
        let targetId: string | null = null;
        let source: 'body:id' | 'body:link' = 'body:id';

        if (/^\[ADR-/i.test(m)) {
          targetId = m.substring(1, m.length - 1);
          source = 'body:id';
        } else if (m.startsWith('(./')) {
          const numMatch = m.match(/\(\.\/([^/.)]+)/);
          if (numMatch) {
            targetId = `ADR-${numMatch[1]}`;
            source = 'body:link';
          }
        }

        if (targetId && !hardTargets.has(targetId) && !seenSoft.has(targetId)) {
          seenSoft.add(targetId);
          edges.push({
            targetId,
            kind: 'soft',
            source,
            rawText: m,
          });
        }
      }
    }
  }

  const frontmatter: ADRFrontmatter = {
    id: id,
    title: title,
    status: status,
    date: frontmatterData.date || new Date().toISOString().split('T')[0],
    deciders: frontmatterData.deciders,
    tags: frontmatterData.tags,
    depends_on: dependsOn,
    supersedes: supersedes,
    conflicts_with: frontmatterData.conflicts_with,
  };

  const context = extractSection(bodyContent, ['Context', 'Problem Statement']);
  const decision = extractSection(bodyContent, ['Decision', 'Resolution']);
  const consequencesText = extractSection(bodyContent, ['Consequences', 'Pros and Cons', 'Pros & Cons']);
  const consequences = parseConsequences(consequencesText);

  return {
    frontmatter,
    context,
    decision,
    consequences,
    rawContent: content,
    edges,
  };
}

/**
 * Derives a deterministic fallback ADR ID from a file path or filename.
 * Generic filenames (README.md, index.md) use their parent directory name when available.
 */
export function deriveFallbackId(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts[parts.length - 1] ?? '';
  const baseName = fileName.replace(/\.(md|mdx|markdown)$/i, '');
  const lower = baseName.toLowerCase();

  if ((lower === 'readme' || lower === 'index') && parts.length >= 2) {
    const parentDir = parts[parts.length - 2];
    if (parentDir && parentDir !== '.' && parentDir !== '..') {
      return parentDir;
    }
  }

  const numMatch = baseName.match(/^(\d+)/);
  if (numMatch) {
    return `ADR-${numMatch[1]}`;
  }
  return baseName;
}

/**
 * Disambiguates colliding ADR IDs in-place by appending `::relativePath`
 * (and `#n` if still needed). Returns the count of files whose initial ID collided.
 */
export function disambiguateDuplicateIds(parsedADRs: ParsedADR[]): { duplicateIdsCount: number } {
  const initialIdCounts = new Map<string, number>();
  for (const adr of parsedADRs) {
    const id = adr.frontmatter.id;
    initialIdCounts.set(id, (initialIdCounts.get(id) || 0) + 1);
  }

  let duplicateIdsCount = 0;
  const usedIds = new Set<string>();

  for (const adr of parsedADRs) {
    const initialId = adr.frontmatter.id;
    if ((initialIdCounts.get(initialId) || 0) > 1) {
      duplicateIdsCount++;
    }

    let finalId = initialId;
    if (usedIds.has(finalId)) {
      const pathLabel = adr.filePath || 'unknown';
      finalId = `${initialId}::${pathLabel}`;
      let suffix = 1;
      while (usedIds.has(finalId)) {
        finalId = `${initialId}::${pathLabel}#${suffix++}`;
      }
      adr.frontmatter.id = finalId;
    }

    usedIds.add(finalId);
  }

  return { duplicateIdsCount };
}

export interface LinkResolutionOptions {
  baseDir?: string;
  existingFiles?: Iterable<string>;
  repoFiles?: Iterable<string>;
  analyzedFolders?: string[];
  fileExists?: (relativePath: string) => boolean;
}

const NON_DECISION_ASSET_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.pdf',
  '.drawio', '.puml', '.css', '.js', '.ts', '.json', '.yaml', '.yml',
]);

function normalizePosixPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop();
      } else {
        resolved.push('..');
      }
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

function resolveRelativePosixPath(sourceFilePath: string, target: string): string {
  if (target.startsWith('/')) {
    return normalizePosixPath(target.slice(1));
  }
  const sourceNorm = normalizePosixPath(sourceFilePath);
  const lastSlash = sourceNorm.lastIndexOf('/');
  const sourceDir = lastSlash >= 0 ? sourceNorm.slice(0, lastSlash) : '';
  return normalizePosixPath(sourceDir ? `${sourceDir}/${target}` : target);
}

function createFileExistsChecker(options?: LinkResolutionOptions): (relPath: string) => boolean {
  const combinedExisting: string[] = [];
  const existingDirs = new Set<string>();

  const addEntry = (rawPath: string) => {
    const norm = normalizePosixPath(rawPath).toLowerCase();
    if (!norm) return;
    combinedExisting.push(norm);
    const parts = norm.split('/');
    for (let i = 1; i < parts.length; i++) {
      existingDirs.add(parts.slice(0, i).join('/'));
    }
  };

  if (options?.existingFiles) {
    for (const f of options.existingFiles) addEntry(f);
  }
  if (options?.repoFiles) {
    for (const f of options.repoFiles) addEntry(f);
  }

  const existingSet = combinedExisting.length > 0 ? new Set(combinedExisting) : null;

  let nodeFs: { existsSync: (p: string) => boolean } | undefined;
  let nodePath: { resolve: (...args: string[]) => string } | undefined;
  if (options?.baseDir && typeof process !== 'undefined') {
    const proc = process as unknown as { getBuiltinModule?: (id: string) => unknown };
    if (typeof proc.getBuiltinModule === 'function') {
      nodeFs = proc.getBuiltinModule('fs') as typeof nodeFs;
      nodePath = proc.getBuiltinModule('path') as typeof nodePath;
    }
  }

  return (relPath: string): boolean => {
    if (relPath.startsWith('..')) return false;
    const norm = normalizePosixPath(relPath).toLowerCase().replace(/\/+$/, '');
    if (options?.fileExists && options.fileExists(relPath)) return true;
    if (existingSet && (existingSet.has(norm) || existingDirs.has(norm))) return true;
    if (options?.baseDir && nodeFs && nodePath) {
      try {
        return nodeFs.existsSync(nodePath.resolve(options.baseDir, relPath));
      } catch {
        return false;
      }
    }
    return false;
  };
}

function isOutsideAnalyzedFolders(resolvedPath: string, analyzedFolders?: string[]): boolean {
  if (!analyzedFolders || analyzedFolders.length === 0) return false;
  const normTarget = normalizePosixPath(resolvedPath).toLowerCase().replace(/\/+$/, '');
  for (const folder of analyzedFolders) {
    const normFolder = normalizePosixPath(folder).toLowerCase().replace(/\/+$/, '');
    if (!normFolder || normFolder === '.') return false;
    if (normTarget === normFolder || normTarget.startsWith(`${normFolder}/`)) {
      return false;
    }
  }
  return true;
}

function stripBodyFrontmatter(rawContent: string): string {
  const fmMatch = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return fmMatch ? rawContent.slice(fmMatch[0].length) : rawContent;
}

function parseLinkTarget(rawInner: string): string {
  let inner = rawInner.trim();
  if (inner.startsWith('<')) {
    const closeIdx = inner.indexOf('>');
    if (closeIdx > 0) {
      inner = inner.slice(1, closeIdx).trim();
    }
  } else {
    inner = inner.replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, '').trim();
  }
  return inner;
}

function registerAliasesForAdr(adr: ParsedADR, aliasToAdrs: Map<string, Set<ParsedADR>>): void {
  const addAlias = (alias: string) => {
    const key = alias.trim().toLowerCase();
    if (!key) return;
    let set = aliasToAdrs.get(key);
    if (!set) {
      set = new Set<ParsedADR>();
      aliasToAdrs.set(key, set);
    }
    set.add(adr);
  };

  const id = adr.frontmatter.id;
  addAlias(id);

  // Register numeric-prefix aliases (adr-020, ADR-020, ADR-20, 020, 20) case-insensitively
  const baseId = id.split('::')[0];
  const idNumMatch = baseId.match(/^(?:adr[-_]?)?(\d+)(?:[-_].*)?$/i);
  if (idNumMatch) {
    const rawNum = idNumMatch[1];
    const unpadded = String(parseInt(rawNum, 10));
    addAlias(rawNum);
    addAlias(unpadded);
    addAlias(`adr-${rawNum}`);
    addAlias(`adr-${unpadded}`);
  }
}

function resolveAliasToken(
  token: string,
  aliasToAdrs: Map<string, Set<ParsedADR>>
): { status: 'resolved'; resolvedId: string } | { status: 'ambiguous' } | { status: 'broken' } {
  const lower = token.trim().toLowerCase();
  let matches = aliasToAdrs.get(lower);

  if (!matches) {
    const numMatch = lower.match(/^adr[-_]?(\d+)$/i);
    if (numMatch) {
      const unpadded = `adr-${parseInt(numMatch[1], 10)}`;
      matches = aliasToAdrs.get(unpadded);
    }
  }

  if (!matches || matches.size === 0) {
    return { status: 'broken' };
  }
  if (matches.size > 1) {
    return { status: 'ambiguous' };
  }
  const [targetAdr] = matches;
  return { status: 'resolved', resolvedId: targetAdr.frontmatter.id };
}

const COMMON_DOMAIN_TLDS = new Set([
  'com', 'org', 'net', 'io', 'dev', 'edu', 'gov', 'co', 'uk', 'de',
  'jp', 'fr', 'ai', 'app', 'rs', 'me', 'info', 'biz', 'xyz', 'tech', 'cloud',
]);

function isNotAFileLink(target: string): boolean {
  if (!target || target.startsWith('#')) return true;
  if (/^(?:mailto:|tel:)/i.test(target)) return true;
  if (target.includes('::')) return true;
  if (/^www\.[a-z0-9-]+/i.test(target)) return true;

  // Scheme-less domain-like hostnames (e.g. git.k8s.io/enhancements/..., example.com/spec)
  // Exclude relative paths (./, ../, /) and files with non-TLD extensions (.md, .go, .proto)
  if (!target.startsWith('.') && !target.startsWith('/')) {
    const hostMatch = target.match(/^([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:[/?#]|$)/i);
    if (hostMatch) {
      const host = hostMatch[1];
      const lastLabel = host.split('.').pop()?.toLowerCase() || '';
      if (COMMON_DOMAIN_TLDS.has(lastLabel)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves relative Markdown body links and bare ID mentions across a batch of
 * parsed ADRs, classifying each as `resolved`, `non-decision`, `outside-scope`,
 * `ambiguous`, `external`, `not-a-file-link`, or `broken`.
 */
export function resolveBatchLinks(parsedADRs: ParsedADR[], options?: LinkResolutionOptions): void {
  const pathToId = new Map<string, string>();
  const aliasToAdrs = new Map<string, Set<ParsedADR>>();

  for (const adr of parsedADRs) {
    registerAliasesForAdr(adr, aliasToAdrs);
    if (!adr.filePath) continue;
    const norm = normalizePosixPath(adr.filePath).toLowerCase();
    pathToId.set(norm, adr.frontmatter.id);
    const noExt = norm.replace(/\.(md|mdx|markdown)$/i, '');
    if (!pathToId.has(noExt)) {
      pathToId.set(noExt, adr.frontmatter.id);
    }
  }

  const fileExists = createFileExistsChecker(options);
  const mdLinkRegex = /\[[^\]]*\]\(([^)\r\n]+)\)/g;
  const bareIdRegex = /\[(ADR-[\w-]+)\](?!\()/gi;

  for (const adr of parsedADRs) {
    const nonLinkEdges = (adr.edges || []).filter(
      (e) => e.source !== 'body:link' && e.source !== 'body:id'
    );
    const seenTargets = new Set<string>(nonLinkEdges.map((e) => e.targetId));
    const resolvedEdges: ADREdgeRef[] = [...nonLinkEdges];
    const classifiedLinks: ClassifiedLink[] = [];

    const body = stripBodyFrontmatter(adr.rawContent || '');
    const sourcePath = adr.filePath || '';

    let match: RegExpExecArray | null;
    mdLinkRegex.lastIndex = 0;
    while ((match = mdLinkRegex.exec(body)) !== null) {
      const rawInner = match[1];
      const rawLinkText = `(${rawInner})`;
      const targetWithFragment = parseLinkTarget(rawInner);

      if (/^(?:https?:|ftp:|\/\/)/i.test(targetWithFragment)) {
        classifiedLinks.push({
          rawLinkText,
          targetPath: targetWithFragment,
          classification: 'external',
        });
        continue;
      }

      if (isNotAFileLink(targetWithFragment)) {
        classifiedLinks.push({
          rawLinkText,
          targetPath: targetWithFragment,
          classification: 'not-a-file-link',
        });
        continue;
      }

      const cleanTarget = targetWithFragment.split('#')[0].split('?')[0].trim();
      if (!cleanTarget) {
        classifiedLinks.push({
          rawLinkText,
          targetPath: targetWithFragment,
          classification: 'not-a-file-link',
        });
        continue;
      }

      const resolvedPath = resolveRelativePosixPath(sourcePath, cleanTarget);
      const lower = resolvedPath.toLowerCase();
      const trimmedDir = lower.replace(/\/+$/, '');

      const resolvedId =
        pathToId.get(lower) ??
        pathToId.get(`${lower}.md`) ??
        pathToId.get(`${lower}.mdx`) ??
        pathToId.get(`${lower}.markdown`) ??
        pathToId.get(`${trimmedDir}/readme.md`) ??
        pathToId.get(`${trimmedDir}/index.md`);

      if (resolvedId) {
        classifiedLinks.push({
          rawLinkText,
          targetPath: resolvedPath,
          classification: 'resolved',
          resolvedId,
        });
        if (resolvedId !== adr.frontmatter.id && !seenTargets.has(resolvedId)) {
          seenTargets.add(resolvedId);
          resolvedEdges.push({
            targetId: resolvedId,
            kind: 'soft',
            source: 'body:link',
            rawText: rawLinkText,
          });
        }
        continue;
      }

      const extMatch = lower.match(/(\.[a-z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : '';
      const hasRepoTree = options?.repoFiles !== undefined;
      let classification: LinkClassification = 'broken';

      const targetExists =
        fileExists(resolvedPath) ||
        (!ext && (fileExists(`${resolvedPath}.md`) || fileExists(`${resolvedPath}.mdx`))) ||
        (!hasRepoTree && Boolean(ext && NON_DECISION_ASSET_EXTS.has(ext)));

      if (targetExists) {
        classification = isOutsideAnalyzedFolders(resolvedPath, options?.analyzedFolders)
          ? 'outside-scope'
          : 'non-decision';
      }

      classifiedLinks.push({
        rawLinkText,
        targetPath: resolvedPath,
        classification,
      });

      if (classification === 'broken' && !seenTargets.has(resolvedPath)) {
        seenTargets.add(resolvedPath);
        resolvedEdges.push({
          targetId: resolvedPath,
          kind: 'soft',
          source: 'body:link',
          rawText: rawLinkText,
        });
      }
    }

    // Resolve bare [ADR-XXX] ID mentions via alias table
    let idMatch: RegExpExecArray | null;
    bareIdRegex.lastIndex = 0;
    while ((idMatch = bareIdRegex.exec(body)) !== null) {
      const token = idMatch[1];
      const rawLinkText = idMatch[0];
      const resolution = resolveAliasToken(token, aliasToAdrs);

      if (resolution.status === 'resolved') {
        classifiedLinks.push({
          rawLinkText,
          targetPath: token,
          classification: 'resolved',
          resolvedId: resolution.resolvedId,
        });
        if (resolution.resolvedId !== adr.frontmatter.id && !seenTargets.has(resolution.resolvedId)) {
          seenTargets.add(resolution.resolvedId);
          resolvedEdges.push({
            targetId: resolution.resolvedId,
            kind: 'soft',
            source: 'body:id',
            rawText: rawLinkText,
          });
        }
      } else if (resolution.status === 'ambiguous') {
        classifiedLinks.push({
          rawLinkText,
          targetPath: token,
          classification: 'ambiguous',
        });
      } else {
        classifiedLinks.push({
          rawLinkText,
          targetPath: token,
          classification: 'broken',
        });
        if (!seenTargets.has(token)) {
          seenTargets.add(token);
          resolvedEdges.push({
            targetId: token,
            kind: 'soft',
            source: 'body:id',
            rawText: rawLinkText,
          });
        }
      }
    }

    adr.edges = resolvedEdges;
    adr.links = classifiedLinks;
  }
}

export function parseBatchADRs(
  files: Array<{ name: string; content: string; filePath?: string }>,
  options?: LinkResolutionOptions
): ParsedADR[] {
  const parsedADRs: ParsedADR[] = [];

  for (const file of files) {
    if (!file.name.endsWith('.md') && !file.name.endsWith('.mdx')) {
      continue;
    }

    try {
      const targetPath = file.filePath ?? file.name;
      const fallbackId = deriveFallbackId(targetPath);

      const parsed = parseADRContent(file.content, fallbackId);
      parsed.filePath = targetPath;
      parsedADRs.push(parsed);
    } catch (e) {
      console.warn(`Error parsing ADR file ${file.name}:`, e);
    }
  }

  resolveBatchLinks(parsedADRs, options);

  return parsedADRs;
}

interface ADRFrontmatterInput {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  timestamp: string;
  dependencies?: string[];
  supersedes?: string;
}

function extractMarkdownSection(content: string, headerName: string): string | null {
  const regex = new RegExp(`##\\s+${headerName}[\\r\\n]+([\\s\\S]*?)(?=(?:\\r?\\n##\\s+(?!#)|$))`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

export function parseADRMarkdown(fileContent: string, filename?: string): NirnayADR {
  const frontmatterRegex = /^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/;
  const match = fileContent.match(frontmatterRegex);

  if (!match) {
    throw new Error('Invalid ADR format: Missing YAML frontmatter headers.');
  }

  const rawYaml = match[1];
  const markdownBody = match[2];
  const metadata = yaml.load(rawYaml) as ADRFrontmatterInput;

  const context = extractMarkdownSection(markdownBody, 'Context') || 'No context provided.';
  const decision = extractMarkdownSection(markdownBody, 'Decision') || 'No decision documented.';

  const consequencesRaw = extractMarkdownSection(markdownBody, 'Consequences') || '';

  const extractListMultiple = (content: string, subheaders: string[]): string[] => {
    for (const subheader of subheaders) {
      const regex = new RegExp(`### ${subheader}\\s*[\\r\\n]+([\\s\\S]*?)(?=\\r?\\n### |$)`, 'i');
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

  const fallbackId = filename ? filename.replace(/\.(md|markdown)$/i, '') : `ADR-${Math.random().toString(36).substring(2, 8)}`;
  
  return {
    id: metadata.id || fallbackId,
    title: metadata.title || fallbackId,
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
