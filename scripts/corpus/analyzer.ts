import path from 'path';
import fs from 'fs-extra';
import glob from 'fast-glob';
import * as yaml from 'js-yaml';
import { parseADRContent } from '../../src/core/adrParser.js';
import { validateAndComputeDAG } from '../../src/core/dagEngine.js';
import type { ParsedADR } from '../../src/core/types.js';
import type {
  FileParseFailure,
  FailureReasonCount,
  ExtractionQualityMetrics,
  CycleEdgeEvidence,
  BrokenLinkEvidence,
} from './types.js';

export interface DecisionFileInput {
  relativePath: string;
  content: string;
}

export interface AnalysisEvidence {
  cycles: Array<{
    cyclePath: string[];
    edges: CycleEdgeEvidence[];
  }>;
  brokenLinks: BrokenLinkEvidence[];
}

export interface AnalysisOutcome {
  filesFound: number;
  filesParsedOK: number;
  parseRatePercent: number;
  parseFailuresCount: number;
  parseFailures: FileParseFailure[];
  topFailureReasons: FailureReasonCount[];
  extractionQuality: ExtractionQualityMetrics;
  duplicateIdsCount: number;
  uniqueIdsCount: number;
  nodes: number;
  edges: number;
  edgeDensity: number;
  isolatedNodes: number;
  cyclesFound: boolean;
  cyclePath?: string[];
  brokenLinks: number;
  missingDependencies: Array<{ adrId: string; missingId: string }>;
  evidence: AnalysisEvidence;
}

export function aggregateFailureReasons(failures: FileParseFailure[]): FailureReasonCount[] {
  const counts = new Map<string, number>();
  for (const failure of failures) {
    const raw = failure.reason || 'Unknown parse error';
    // Normalize common error prefixes
    const normalized = raw.split('\n')[0].trim();
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export function deriveFallbackId(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const baseName = path.posix.basename(normalized).replace(/\.(md|mdx)$/i, '');
  const lower = baseName.toLowerCase();

  if (lower === 'readme' || lower === 'index') {
    const parentDir = path.posix.basename(path.posix.dirname(normalized));
    if (parentDir && parentDir !== '.' && parentDir !== '/') {
      return parentDir;
    }
  }

  const numMatch = baseName.match(/^(\d+)/);
  if (numMatch) {
    return `ADR-${numMatch[1]}`;
  }
  return baseName;
}

function extractRawFrontmatter(content: string): {
  data: Record<string, unknown> | null;
  bodyContent: string;
} {
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const fmMatch = content.match(fmRegex);
  if (!fmMatch) {
    return { data: null, bodyContent: content };
  }
  const bodyContent = content.slice(fmMatch[0].length).trim();
  try {
    const parsedYaml = yaml.load(fmMatch[1]);
    if (typeof parsedYaml === 'object' && parsedYaml !== null) {
      return { data: parsedYaml as Record<string, unknown>, bodyContent };
    }
  } catch {
    // Ignore YAML parse errors here; adrParser handles them
  }
  return { data: null, bodyContent };
}

export function findRawLinkText(content: string, targetId: string): string {
  const { data, bodyContent } = extractRawFrontmatter(content);

  if (data) {
    const depKeys = ['depends_on', 'depends-on', 'dependencies', 'requires'] as const;
    for (const key of depKeys) {
      const val = data[key];
      if (val !== undefined && val !== null) {
        const items = Array.isArray(val) ? val : [val];
        for (const item of items) {
          if (String(item) === targetId) {
            return `frontmatter ${key}: ${String(item)}`;
          }
        }
      }
    }
  }

  if (bodyContent) {
    const linkRegex = /(?:\[ADR-[\w-]+\]|\(\.\/[\w-]+[^)]*\))/g;
    const matches = bodyContent.match(linkRegex);
    if (matches) {
      for (const m of matches) {
        if (m.startsWith('[ADR-') && m.substring(1, m.length - 1) === targetId) {
          return m;
        }
        if (m.startsWith('(./')) {
          const numMatch = m.match(/\(\.\/([^/.)]+)/);
          if (numMatch && `ADR-${numMatch[1]}` === targetId) {
            return m;
          }
        }
      }
    }
  }

  return `unresolved-source (${targetId})`;
}

function toPercent(count: number, total: number): number {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;
}

export function analyzeDecisionFiles(files: DecisionFileInput[]): AnalysisOutcome {
  const filesFound = files.length;
  const parsedADRs: ParsedADR[] = [];
  const parseFailures: FileParseFailure[] = [];
  const idToRecord = new Map<string, { relativePath: string; content: string }>();

  let realTitleCount = 0;
  let statusFoundCount = 0;
  let idFromFrontmatterCount = 0;
  let idFromFilenameCount = 0;
  let idGeneratedCount = 0;

  for (const file of files) {
    try {
      if (!file.content || file.content.trim().length === 0) {
        throw new Error('File content is empty or contains only whitespace');
      }

      const fallbackId = deriveFallbackId(file.relativePath);
      const parsed = parseADRContent(file.content, fallbackId);

      if (!parsed || !parsed.frontmatter || !parsed.frontmatter.id) {
        throw new Error('Parser returned incomplete ADR structure');
      }

      parsed.filePath = file.relativePath;

      const { data: rawFm } = extractRawFrontmatter(file.content);

      if (parsed.frontmatter.title && parsed.frontmatter.title !== 'Untitled ADR') {
        realTitleCount++;
      }

      if (rawFm && (rawFm.status !== undefined || rawFm.stage !== undefined || rawFm.state !== undefined)) {
        statusFoundCount++;
      }

      if (rawFm && rawFm.id !== undefined && String(rawFm.id) === parsed.frontmatter.id) {
        idFromFrontmatterCount++;
      } else if (parsed.frontmatter.id === fallbackId) {
        idFromFilenameCount++;
      } else {
        idGeneratedCount++;
      }

      parsedADRs.push(parsed);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      parseFailures.push({
        file: file.relativePath,
        reason: errorMessage,
      });
    }
  }

  const filesParsedOK = parsedADRs.length;
  const parseFailuresCount = parseFailures.length;
  const parseRatePercent = toPercent(filesParsedOK, filesFound);
  const topFailureReasons = aggregateFailureReasons(parseFailures);

  const extractionQuality: ExtractionQualityMetrics = {
    realTitleCount,
    realTitlePercent: toPercent(realTitleCount, filesParsedOK),
    statusFoundCount,
    statusFoundPercent: toPercent(statusFoundCount, filesParsedOK),
    idFromFrontmatterCount,
    idFromFrontmatterPercent: toPercent(idFromFrontmatterCount, filesParsedOK),
    idFromFilenameCount,
    idFromFilenamePercent: toPercent(idFromFilenameCount, filesParsedOK),
    idGeneratedCount,
    idGeneratedPercent: toPercent(idGeneratedCount, filesParsedOK),
    edgeSourceBreakdownSupported: false,
  };

  if (parsedADRs.length === 0) {
    return {
      filesFound,
      filesParsedOK: 0,
      parseRatePercent: 0,
      parseFailuresCount,
      parseFailures,
      topFailureReasons,
      extractionQuality,
      duplicateIdsCount: 0,
      uniqueIdsCount: 0,
      nodes: 0,
      edges: 0,
      edgeDensity: 0,
      isolatedNodes: 0,
      cyclesFound: false,
      brokenLinks: 0,
      missingDependencies: [],
      evidence: { cycles: [], brokenLinks: [] },
    };
  }

  // Count initial ID collisions across parsed files, then disambiguate by appending relativePath
  const initialIdCounts = new Map<string, number>();
  for (const adr of parsedADRs) {
    const id = adr.frontmatter.id;
    initialIdCounts.set(id, (initialIdCounts.get(id) || 0) + 1);
  }

  let duplicateIdsCount = 0;
  const usedIds = new Set<string>();
  const fileContentByPath = new Map<string, string>();
  for (const file of files) {
    fileContentByPath.set(file.relativePath, file.content);
  }

  for (const adr of parsedADRs) {
    const initialId = adr.frontmatter.id;
    if ((initialIdCounts.get(initialId) || 0) > 1) {
      duplicateIdsCount++;
    }

    let finalId = initialId;
    if (usedIds.has(finalId)) {
      finalId = `${initialId}::${adr.filePath || 'unknown'}`;
      let suffix = 1;
      while (usedIds.has(finalId)) {
        finalId = `${initialId}::${adr.filePath || 'unknown'}#${suffix++}`;
      }
      adr.frontmatter.id = finalId;
    }

    usedIds.add(finalId);
    idToRecord.set(finalId, {
      relativePath: adr.filePath || 'unknown',
      content: adr.rawContent,
    });
  }

  const uniqueIdsCount = usedIds.size;

  const { validationResult, engine, mappedAdrs } = validateAndComputeDAG(parsedADRs);
  const nodes = mappedAdrs.length;

  let totalEdges = 0;
  let isolatedNodesCount = 0;

  for (const adr of mappedAdrs) {
    const deps = engine.getDirectDependencies(adr.id);
    const dependents = engine.getDirectDependents(adr.id);
    totalEdges += dependents.length;

    if (deps.length === 0 && dependents.length === 0) {
      isolatedNodesCount++;
    }
  }

  const edgeDensity = nodes > 0 ? Number((totalEdges / nodes).toFixed(3)) : 0;
  const brokenLinks = validationResult.missingDependencies.length;

  const cycleEvidence: AnalysisEvidence['cycles'] = [];
  if (validationResult.hasCycle && validationResult.cyclePath && validationResult.cyclePath.length >= 2) {
    const edges: CycleEdgeEvidence[] = [];
    for (let i = 0; i < validationResult.cyclePath.length - 1; i++) {
      // DAGEngine adjacencyList maps dependency -> dependent, so cyclePath[i] is depended on by cyclePath[i+1]
      const dependencyId = validationResult.cyclePath[i];
      const dependentId = validationResult.cyclePath[i + 1];
      const dependentRecord = idToRecord.get(dependentId);
      const dependencyRecord = idToRecord.get(dependencyId);
      const rawLinkText = dependentRecord
        ? findRawLinkText(dependentRecord.content, dependencyId)
        : `unresolved-source (${dependencyId})`;

      edges.push({
        dependentId,
        dependentFile: dependentRecord?.relativePath || 'unknown',
        dependencyId,
        dependencyFile: dependencyRecord?.relativePath || 'unknown',
        rawLinkText,
      });
    }
    cycleEvidence.push({
      cyclePath: validationResult.cyclePath,
      edges,
    });
  }

  const brokenLinkEvidence: BrokenLinkEvidence[] = validationResult.missingDependencies
    .slice(0, 10)
    .map(({ adrId, missingId }) => {
      const sourceRecord = idToRecord.get(adrId);
      const rawLinkText = sourceRecord
        ? findRawLinkText(sourceRecord.content, missingId)
        : `unresolved-source (${missingId})`;
      return {
        sourceId: adrId,
        sourceFile: sourceRecord?.relativePath || 'unknown',
        missingId,
        rawLinkText,
      };
    });

  return {
    filesFound,
    filesParsedOK,
    parseRatePercent,
    parseFailuresCount,
    parseFailures,
    topFailureReasons,
    extractionQuality,
    duplicateIdsCount,
    uniqueIdsCount,
    nodes,
    edges: totalEdges,
    edgeDensity,
    isolatedNodes: isolatedNodesCount,
    cyclesFound: validationResult.hasCycle,
    cyclePath: validationResult.cyclePath,
    brokenLinks,
    missingDependencies: validationResult.missingDependencies,
    evidence: {
      cycles: cycleEvidence,
      brokenLinks: brokenLinkEvidence,
    },
  };
}

export async function readDirectoryDecisionFiles(
  repoRoot: string,
  subfolders: string[]
): Promise<DecisionFileInput[]> {
  const allFiles: DecisionFileInput[] = [];

  for (const subfolder of subfolders) {
    const targetPath = path.resolve(repoRoot, subfolder);
    if (!await fs.pathExists(targetPath)) {
      continue;
    }

    const matches = (await glob('**/*.{md,mdx}', {
      cwd: targetPath,
      absolute: true,
      onlyFiles: true,
      caseSensitiveMatch: false,
    })).sort();

    for (const absolutePath of matches) {
      try {
        const content = await fs.readFile(absolutePath, 'utf-8');
        const relativeToRepo = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
        allFiles.push({
          relativePath: relativeToRepo,
          content,
        });
      } catch {
        const relativeToRepo = path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
        allFiles.push({
          relativePath: relativeToRepo,
          content: '', // Trigger empty/read failure in analyzeDecisionFiles
        });
      }
    }
  }

  return allFiles;
}
