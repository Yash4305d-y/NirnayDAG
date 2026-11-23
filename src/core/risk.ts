/**
 * Architecture Risk Model (v1, heuristic)
 *
 * NOTE: This is a v1 heuristic model based on direct dependents and total cascade.
 * It will be replaced with a formal graph-centrality model (PageRank / betweenness)
 * in a later phase.
 */

export interface RiskFactorBreakdown {
  directDependentsCount: number;
  directDependentsWeight: number;
  directDependentsScore: number;
  cascadeCount: number;
  cascadeWeight: number;
  cascadeScore: number;
  depth?: number;
  rawScore: number;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export interface ArchitectureRiskResult {
  score: number; // 0 - 100
  level: RiskLevel;
  breakdown: RiskFactorBreakdown;
  explanation: string;
}

export interface RiskInputParams {
  directDependentsCount?: number;
  directDependents?: string[];
  cascadeCount?: number;
  cascade?: string[];
  depth?: number;
}

export const RISK_WEIGHTS = {
  direct: 5,
  cascade: 10,
} as const;

/**
 * Computes an explainable architecture risk score (0-100) and risk level.
 * Marked as v1, heuristic; to be replaced by graph centrality in a later phase.
 */
export function calculateArchitectureRisk(params: RiskInputParams): ArchitectureRiskResult {
  const directCount = params.directDependentsCount ?? params.directDependents?.length ?? 0;
  const cascadeCount = params.cascadeCount ?? params.cascade?.length ?? 0;
  const depth = params.depth;

  const directDependentsScore = directCount * RISK_WEIGHTS.direct;
  const cascadeScore = cascadeCount * RISK_WEIGHTS.cascade;
  const rawScore = directDependentsScore + cascadeScore;
  const score = Math.min(100, rawScore);

  let level: RiskLevel = 'Low';
  if (score > 60) {
    level = 'High';
  } else if (score > 30) {
    level = 'Medium';
  }

  const depthInfo = depth !== undefined ? `, depth ${depth}` : '';
  const explanation = `Score ${score}/100 (${level}): ${directCount} direct dependents (${directDependentsScore} pts, weight ${RISK_WEIGHTS.direct}) and ${cascadeCount} cascading descendants (${cascadeScore} pts, weight ${RISK_WEIGHTS.cascade})${depthInfo}.`;

  return {
    score,
    level,
    breakdown: {
      directDependentsCount: directCount,
      directDependentsWeight: RISK_WEIGHTS.direct,
      directDependentsScore,
      cascadeCount,
      cascadeWeight: RISK_WEIGHTS.cascade,
      cascadeScore,
      depth,
      rawScore,
    },
    explanation,
  };
}
