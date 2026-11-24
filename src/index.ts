export { DAGEngine } from './core/dagEngine.js';
export type { DAGValidationResult, DAGQueryOptions, MutualReference } from './core/dagEngine.js';
export { getLayoutedGraph } from './core/layoutEngine.js';
export { parseADRMarkdown } from './core/adrParser.js';
export type { NirnayADR, DecisionStatus, EdgeKind, EdgeSource, ADREdgeRef } from './core/types.js';
export { calculateArchitectureRisk } from './core/risk.js';
export type { ArchitectureRiskResult, RiskFactorBreakdown, RiskLevel, RiskInputParams } from './core/risk.js';
export { generatePRReport } from './core/report.js';
export type { ReportOptions, ReportResult } from './core/report.js';
