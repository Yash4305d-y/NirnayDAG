export interface CorpusRepoConfig {
  name: string;
  url: string;
  commitSha: string;
  subfolders: string[];
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
  idFromFrontmatterCount: number;
  idFromFrontmatterPercent: number;
  idFromFilenameCount: number;
  idFromFilenamePercent: number;
  idGeneratedCount: number;
  idGeneratedPercent: number;
  edgeSourceBreakdownSupported: boolean;
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

export interface RepoEvidence {
  repo: string;
  commitSha: string;
  cycles: Array<{
    cyclePath: string[];
    edges: CycleEdgeEvidence[];
  }>;
  brokenLinks: BrokenLinkEvidence[];
}

export interface CorpusEvidenceReport {
  timestamp: string;
  runnerVersion: string;
  repositories: RepoEvidence[];
}

export interface RepoBenchmarkResult {
  repo: string;
  url: string;
  format: string;
  license: string;
  commitSha: string;
  filesFound: number;
  filesParsedOK: number;
  parseRatePercent: number;
  parseFailuresCount: number;
  parseFailures: FileParseFailure[];
  topFailureReasons: FailureReasonCount[];
  extractionQuality: ExtractionQualityMetrics;
  nodes: number;
  edges: number;
  edgeDensity: number;
  isolatedNodes: number;
  cyclesFound: boolean;
  cyclePath?: string[];
  brokenLinks: number;
  missingDependencies: Array<{ adrId: string; missingId: string }>;
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
    totalFilesParsedOK: number;
    averageParseRatePercent: number;
    totalNodes: number;
    totalEdges: number;
    totalBrokenLinks: number;
    totalCyclesDetected: number;
  };
  results: RepoBenchmarkResult[];
  droppedRepositories: DroppedRepoConfig[];
}
