import type { ADRStatus, StatusSource, TitleSource } from '../../src/core/types.js';

export interface CorpusRepoConfig {
  name: string;
  url: string;
  commitSha: string;
  subfolders: string[];
  include?: string[];
  exclude?: string[];
  format: 'madr' | 'nygard' | 'rfc' | 'kep' | 'adr' | string;
  license: string;
  description?: string;
}

export interface DroppedRepoConfig {
  name: string;
  url: string;
  license: string;
  reason: string;
}

export interface CorpusRegistry {
  description: string;
  licenseNotice: string;
  repositories: CorpusRepoConfig[];
  evaluatedAndDropped: DroppedRepoConfig[];
}

export interface FileParseFailure {
  file: string;
  reason: string;
}

export interface FailureReasonCount {
  reason: string;
  count: number;
}

export interface ExtractionQualityMetrics {
  realTitleCount: number;
  realTitlePercent: number;
  statusFoundCount: number;
  statusFoundPercent: number;
  statusFromFrontmatterPercent?: number;
  statusFromSectionPercent?: number;
  statusFromLinePercent?: number;
  statusFromKepYamlPercent?: number;
  titleFromFrontmatterPercent?: number;
  titleFromHeadingPercent?: number;
  titleFromMetadataLinePercent?: number;
  titleFromKepYamlPercent?: number;
  titleFromSlugPercent?: number;
  idFromFrontmatterCount: number;
  idFromFrontmatterPercent: number;
  idFromFilenameCount: number;
  idFromFilenamePercent: number;
  idGeneratedCount: number;
  idGeneratedPercent: number;
  edgeSourceBreakdownSupported: boolean;
}

export interface ExtractionSampleEvidence {
  file: string;
  id: string;
  title: string;
  titleSource: TitleSource;
  status: ADRStatus;
  statusSource: StatusSource;
  tags?: string[];
}

export interface CycleEdgeEvidence {
  dependentId: string;
  dependentFile: string;
  dependencyId: string;
  dependencyFile: string;
  rawLinkText: string;
}

export interface BrokenLinkEvidence {
  sourceId: string;
  sourceFile: string;
  missingId: string;
  rawLinkText: string;
}

export interface MutualReferenceEvidence {
  pair: [string, string];
  edges: CycleEdgeEvidence[];
}

export interface LintFindingEvidence {
  ruleId: string;
  severity: string;
  nodeId: string;
  files: string[];
  reason: string;
  repo?: string;
}

export interface RepoLintSummary {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
  byRule: {
    'accepted-depends-on-deprecated': number;
    'superseded-without-successor': number;
    'broken-supersedes': number;
    orphan: number;
  };
}

export interface RepoEvidence {
  repo: string;
  commitSha: string;
  excludedFiles?: string[];
  extractionSamples?: ExtractionSampleEvidence[];
  cycles: Array<{
    cyclePath: string[];
    edges: CycleEdgeEvidence[];
  }>;
  mutualReferences: MutualReferenceEvidence[];
  brokenLinks: BrokenLinkEvidence[];
  lintFindings?: Record<string, LintFindingEvidence[]>;
}

export interface CorpusEvidenceReport {
  timestamp: string;
  runnerVersion: string;
  lintFindingsByRule?: Record<string, LintFindingEvidence[]>;
  repositories: RepoEvidence[];
}

export interface RepoBenchmarkResult {
  repo: string;
  url: string;
  format: string;
  license: string;
  commitSha: string;
  filesFound: number;
  excludedCount?: number;
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
  hardEdges: number;
  softEdges: number;
  edgeDensity: number;
  isolatedNodes: number;
  cyclesFound: boolean;
  cyclePath?: string[];
  mutualReferencesCount: number;
  mutualReferences: Array<{ pair: [string, string] }>;
  resolvedLinks?: number;
  nonDecisionLinks?: number;
  outsideScopeLinks?: number;
  ambiguousLinks?: number;
  externalLinks?: number;
  notAFileLinks?: number;
  brokenLinks: number;
  before?: {
    nodes?: number;
    edges: number;
    brokenLinks: number;
    realTitlePercent?: number;
    statusFoundPercent?: number;
    hardEdges?: number;
  };
  missingDependencies: Array<{ adrId: string; missingId: string }>;
  lintSummary?: RepoLintSummary;
  timing: {
    cloneMs: number;
    analysisMs: number;
    totalMs: number;
  };
}

export interface CorpusBenchmarkReport {
  timestamp: string;
  runnerVersion: string;
  licenseNotice: string;
  summary: {
    totalReposAnalyzed: number;
    totalFilesFound: number;
    totalExcludedFiles?: number;
    totalFilesParsedOK: number;
    averageParseRatePercent: number;
    totalNodes: number;
    totalEdges: number;
    totalDuplicateIds: number;
    totalUniqueIds: number;
    totalHardEdges: number;
    totalSoftEdges: number;
    totalResolvedLinks?: number;
    totalNonDecisionLinks?: number;
    totalOutsideScopeLinks?: number;
    totalAmbiguousLinks?: number;
    totalExternalLinks?: number;
    totalNotAFileLinks?: number;
    totalBrokenLinks: number;
    totalCyclesDetected: number;
    totalMutualReferences: number;
    totalLintByRule?: {
      'accepted-depends-on-deprecated': number;
      'superseded-without-successor': number;
      'broken-supersedes': number;
      orphan: number;
    };
  };
  results: RepoBenchmarkResult[];
  droppedRepositories: DroppedRepoConfig[];
}
