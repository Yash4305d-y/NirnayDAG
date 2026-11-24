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
  MutualReferenceEvidence,
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
  mutualReferences: MutualReferenceEvidence[];
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
  nodes: number;
  edges: number;
  hardEdges: number;
  softEdges: number;
  edgeDensity: number;
  isolatedNodes: number;
  cyclesFound: boolean;
  cyclePath?: string[];
  mutualReferencesCount: number;
  mutualReferences: Array<{ pair: [string, string] }>;
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
  const baseName = path.basename(relativePath).replace(/\.(md|mdx)$/i, '');
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

      idToRecord.set(parsed.frontmatter.id, {
        relativePath: file.relativePath,
        content: file.content,
      });

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
    edgeSourceBreakdownSupported: true,
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
      nodes: 0,
      edges: 0,
      hardEdges: 0,
      softEdges: 0,
      edgeDensity: 0,
      isolatedNodes: 0,
      cyclesFound: false,
      mutualReferencesCount: 0,
      mutualReferences: [],
      brokenLinks: 0,
      missingDependencies: [],
      evidence: { cycles: [], mutualReferences: [], brokenLinks: [] },
    };
  }

  const { validationResult, engine, mappedAdrs } = validateAndComputeDAG(parsedADRs);
  const nodes = mappedAdrs.length;

  let hardEdgesCount = 0;
  let softEdgesCount = 0;
  let isolatedNodesCount = 0;

  for (const adr of mappedAdrs) {
    const hardDeps = engine.getDirectDependencies(adr.id);
    const hardDependents = engine.getDirectDependents(adr.id);
    const allDeps = engine.getDirectDependencies(adr.id, { includeSoft: true });
    const allDependents = engine.getDirectDependents(adr.id, { includeSoft: true });
    const softDependents = engine.getSoftDependents(adr.id);

    hardEdgesCount += hardDependents.length;
    softEdgesCount += softDependents.length;

    if (allDeps.length === 0 && allDependents.length === 0 && hardDeps.length === 0) {
      isolatedNodesCount++;
    }
  }

  const totalEdges = hardEdgesCount + softEdgesCount;
  const edgeDensity = nodes > 0 ? Number((totalEdges / nodes).toFixed(3)) : 0;
  const allMissing = [
    ...validationResult.missingDependencies,
    ...(validationResult.missingSoftReferences || []),
  ];
  const brokenLinks = allMissing.length;

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

  const mutualRefs = validationResult.mutualReferences || [];
  const mutualRefEvidence: MutualReferenceEvidence[] = mutualRefs.map(({ pair }) => {
    const [idA, idB] = pair;
    const recA = idToRecord.get(idA);
    const recB = idToRecord.get(idB);
    return {
      pair,
      edges: [
        {
          dependentId: idA,
          dependentFile: recA?.relativePath || 'unknown',
          dependencyId: idB,
          dependencyFile: recB?.relativePath || 'unknown',
          rawLinkText: recA ? findRawLinkText(recA.content, idB) : `unresolved-source (${idB})`,
        },
        {
          dependentId: idB,
          dependentFile: recB?.relativePath || 'unknown',
          dependencyId: idA,
          dependencyFile: recA?.relativePath || 'unknown',
          rawLinkText: recB ? findRawLinkText(recB.content, idA) : `unresolved-source (${idA})`,
        },
      ],
    };
  });

  const brokenLinkEvidence: BrokenLinkEvidence[] = allMissing
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
    nodes,
    edges: totalEdges,
    hardEdges: hardEdgesCount,
    softEdges: softEdgesCount,
    edgeDensity,
    isolatedNodes: isolatedNodesCount,
    cyclesFound: validationResult.hasCycle,
    cyclePath: validationResult.cyclePath,
    mutualReferencesCount: mutualRefs.length,
    mutualReferences: mutualRefs,
    brokenLinks,
    missingDependencies: allMissing,
    evidence: {
      cycles: cycleEvidence,
      mutualReferences: mutualRefEvidence,
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
