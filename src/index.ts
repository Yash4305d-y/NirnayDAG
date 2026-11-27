export { DAGEngine } from './core/dagEngine.js';
export type { DAGValidationResult, DAGQueryOptions, MutualReference } from './core/dagEngine.js';
export { getLayoutedGraph } from './core/layoutEngine.js';
export {
  parseADRMarkdown,
  parseADRContent,
  parseBatchADRs,
  deriveFallbackId,
  disambiguateDuplicateIds,
  resolveBatchLinks,
} from './core/adrParser.js';
export type { LinkResolutionOptions } from './core/adrParser.js';
export type {
  NirnayADR,
  DecisionStatus,
  EdgeKind,
  EdgeSource,
  ADREdgeRef,
  ClassifiedLink,
  LinkClassification,
} from './core/types.js';
export {
  calculateArchitectureRisk,
  calculateGraphRisk,
  computeBetweennessCentrality,
  DEFAULT_RISK_V2_CONFIG,
  MAX_EXACT_BETWEENNESS_NODES,
} from './core/risk.js';
export type {
  ArchitectureRiskResult,
  RiskFactorBreakdown,
  RiskLevel,
  RiskInputParams,
  RiskModelVersion,
  RiskV2Config,
  RiskV2ConfigOverride,
  RiskV2Weights,
  BetweennessMode,
  BetweennessResult,
} from './core/risk.js';
export {
  lintArchitecture,
  loadNirnayConfig,
  DEFAULT_LINT_RULES,
} from './core/linter.js';
export type {
  LintConfig,
  LintFinding,
  LintResult,
  LintRuleId,
  LintSeverity,
  LintSummary,
} from './core/linter.js';
export { generatePRReport } from './core/report.js';
export type { ReportOptions, ReportResult } from './core/report.js';
export {
  getGoverningDecisionsForFiles,
  compileAffectsMatcher,
  normalizeRepoPath,
} from './core/affects.js';
export type {
  AncestorDecision,
  GoverningDecision,
  FileGoverningResult,
} from './core/affects.js';
