import type { DAGEngine } from './dagEngine.js';

export const MAX_EXACT_BETWEENNESS_NODES = 5000;

export type RiskLevel = 'Low' | 'Medium' | 'High';
export type RiskModelVersion = 'v1' | 'v2';
export type BetweennessMode = 'exact' | 'sampled' | 'skipped';

export interface RiskV2Weights {
  directDependents: number;
  cascadeFraction: number;
  longestDepth: number;
  betweennessCentrality: number;
}

export interface RiskV2Config {
  weights: RiskV2Weights;
  depthSaturation: number;
  maxExactBetweennessNodes: number;
  betweennessSampleSize: number;
}

export const DEFAULT_RISK_V2_CONFIG: RiskV2Config = {
  weights: {
    directDependents: 0.30,
    cascadeFraction: 0.35,
    longestDepth: 0.15,
    betweennessCentrality: 0.20,
  },
  depthSaturation: 10,
  maxExactBetweennessNodes: MAX_EXACT_BETWEENNESS_NODES,
  betweennessSampleSize: 256,
};

export interface RiskV2ConfigOverride {
  weights?: Partial<RiskV2Weights>;
  depthSaturation?: number;
  maxExactBetweennessNodes?: number;
  betweennessSampleSize?: number;
}

export interface RiskFactorBreakdown {
  // Common / v1-compatible fields
  directDependentsCount: number;
  directDependentsWeight: number;
  directDependentsScore: number;
  cascadeCount: number;
  cascadeWeight: number;
  cascadeScore: number;
  depth?: number;
  rawScore: number;

  // v2 graph-centrality fields
  totalNodes?: number;
  directDependentsNormalized?: number;
  cascadeFraction?: number;
  longestDepthNormalized?: number;
  longestDepthScore?: number;
  betweennessCentrality?: number;
  betweennessScore?: number;
  betweennessMode?: BetweennessMode;
  weights?: RiskV2Weights;
}

export interface ArchitectureRiskResult {
  score: number; // 0 - 100
  level: RiskLevel;
  modelVersion: RiskModelVersion;
  breakdown: RiskFactorBreakdown;
  explanation: string;
}

export interface RiskInputParams {
  version?: RiskModelVersion;
  directDependentsCount?: number;
  directDependents?: string[];
  cascadeCount?: number;
  cascade?: string[];
  depth?: number;
  // Optional v2 scalar inputs when calling calculateArchitectureRisk directly
  totalNodes?: number;
  betweennessCentrality?: number;
  betweennessMode?: BetweennessMode;
  config?: RiskV2ConfigOverride;
}

/**
 * Legacy v1 weights kept for backward compatibility when `version: 'v1'` is selected.
 */
export const RISK_WEIGHTS = {
  direct: 5,
  cascade: 10,
} as const;

export interface BetweennessResult {
  scores: Map<string, number>;
  mode: BetweennessMode;
  nodeCount: number;
  edgeCount: number;
}

function resolveConfig(override?: RiskV2ConfigOverride): RiskV2Config {
  return {
    weights: {
      ...DEFAULT_RISK_V2_CONFIG.weights,
      ...(override?.weights ?? {}),
    },
    depthSaturation: override?.depthSaturation ?? DEFAULT_RISK_V2_CONFIG.depthSaturation,
    maxExactBetweennessNodes:
      override?.maxExactBetweennessNodes ?? DEFAULT_RISK_V2_CONFIG.maxExactBetweennessNodes,
    betweennessSampleSize:
      override?.betweennessSampleSize ?? DEFAULT_RISK_V2_CONFIG.betweennessSampleSize,
  };
}

function classifyLevel(score: number): RiskLevel {
  if (score > 60) return 'High';
  if (score > 30) return 'Medium';
  return 'Low';
}

/**
 * Computes normalized unweighted directed betweenness centrality on hard edges
 * using Brandes' algorithm.
 *
 * Complexity:
 * - Exact mode (N <= maxExactBetweennessNodes): O(V * E) time, O(V + E) space.
 * - Sampled fallback (N > maxExactBetweennessNodes): O(k * (V + E)) time where
 *   k = betweennessSampleSize (default 256), using deterministic evenly spaced pivots.
 */
export function computeBetweennessCentrality(
  engine: DAGEngine,
  options?: { maxExactBetweennessNodes?: number; betweennessSampleSize?: number }
): BetweennessResult {
  const nodeIds = engine.getNodeIds().slice().sort();
  const n = nodeIds.length;
  const edgeCount = engine.getEdgeCount();
  const scores = new Map<string, number>();
  for (const id of nodeIds) {
    scores.set(id, 0);
  }

  if (n <= 2) {
    return { scores, mode: 'exact', nodeCount: n, edgeCount };
  }

  const maxExact = options?.maxExactBetweennessNodes ?? MAX_EXACT_BETWEENNESS_NODES;
  const sampleSize = options?.betweennessSampleSize ?? DEFAULT_RISK_V2_CONFIG.betweennessSampleSize;

  let pivots: string[];
  let mode: BetweennessMode;
  let scaleFactor = 1;

  if (n <= maxExact) {
    pivots = nodeIds;
    mode = 'exact';
  } else if (sampleSize <= 0) {
    return { scores, mode: 'skipped', nodeCount: n, edgeCount };
  } else {
    const k = Math.min(n, sampleSize);
    pivots = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor((i * n) / k);
      pivots.push(nodeIds[idx]);
    }
    mode = 'sampled';
    scaleFactor = n / pivots.length;
  }

  // Adjacency cache (hard edges only: dependency -> direct dependents)
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) {
    adj.set(id, engine.getDirectDependents(id, { includeSoft: false }));
  }

  const rawCentrality = new Map<string, number>();
  for (const id of nodeIds) {
    rawCentrality.set(id, 0);
  }

  for (const s of pivots) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();

    for (const v of nodeIds) {
      predecessors.set(v, []);
      sigma.set(v, 0);
      dist.set(v, -1);
    }

    sigma.set(s, 1);
    dist.set(s, 0);

    const queue: string[] = [s];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      const dV = dist.get(v)!;
      const sigmaV = sigma.get(v)!;
      const neighbors = adj.get(v) || [];

      for (const w of neighbors) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dV + 1);
        }
        if (dist.get(w) === dV + 1) {
          sigma.set(w, sigma.get(w)! + sigmaV);
          predecessors.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>();
    for (const v of nodeIds) {
      delta.set(v, 0);
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      const sigmaW = sigma.get(w)!;
      const deltaW = delta.get(w)!;
      if (sigmaW > 0) {
        for (const v of predecessors.get(w)!) {
          const contribution = (sigma.get(v)! / sigmaW) * (1 + deltaW);
          delta.set(v, delta.get(v)! + contribution);
        }
      }
      if (w !== s) {
        rawCentrality.set(w, rawCentrality.get(w)! + deltaW);
      }
    }
  }

  const normDenom = (n - 1) * (n - 2);
  for (const id of nodeIds) {
    const scaled = (rawCentrality.get(id)! * scaleFactor) / normDenom;
    scores.set(id, Math.min(1, Math.max(0, scaled)));
  }

  return { scores, mode, nodeCount: n, edgeCount };
}

function calculateRiskV1(params: RiskInputParams): ArchitectureRiskResult {
  const directCount = params.directDependentsCount ?? params.directDependents?.length ?? 0;
  const cascadeCount = params.cascadeCount ?? params.cascade?.length ?? 0;
  const depth = params.depth;

  const directDependentsScore = directCount * RISK_WEIGHTS.direct;
  const cascadeScore = cascadeCount * RISK_WEIGHTS.cascade;
  const rawScore = directDependentsScore + cascadeScore;
  const score = Math.min(100, rawScore);
  const level = classifyLevel(score);

  const depthInfo = depth !== undefined ? `, depth ${depth}` : '';
  const explanation = `Score ${score}/100 (${level}): ${directCount} direct dependents (${directDependentsScore} pts, weight ${RISK_WEIGHTS.direct}) and ${cascadeCount} cascading descendants (${cascadeScore} pts, weight ${RISK_WEIGHTS.cascade})${depthInfo}.`;

  return {
    score,
    level,
    modelVersion: 'v1',
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

function calculateRiskV2FromScalars(params: {
  directCount: number;
  cascadeCount: number;
  depth: number;
  totalNodes: number;
  betweennessCentrality: number;
  betweennessMode: BetweennessMode;
  config?: RiskV2ConfigOverride;
}): ArchitectureRiskResult {
  const cfg = resolveConfig(params.config);
  const denom = Math.max(1, params.totalNodes - 1);

  const directNorm = params.totalNodes > 1 ? Math.min(1, params.directCount / denom) : 0;
  const cascadeFraction = params.totalNodes > 1 ? Math.min(1, params.cascadeCount / denom) : 0;
  const depthNorm = Math.min(1, Math.max(0, params.depth) / Math.max(1, cfg.depthSaturation));
  const betweennessNorm = Math.min(1, Math.max(0, params.betweennessCentrality));

  const directDependentsScore = Number((directNorm * cfg.weights.directDependents * 100).toFixed(2));
  const cascadeScore = Number((cascadeFraction * cfg.weights.cascadeFraction * 100).toFixed(2));
  const longestDepthScore = Number((depthNorm * cfg.weights.longestDepth * 100).toFixed(2));
  const betweennessScore = Number((betweennessNorm * cfg.weights.betweennessCentrality * 100).toFixed(2));

  const rawScore = Number(
    (directDependentsScore + cascadeScore + longestDepthScore + betweennessScore).toFixed(2)
  );
  const score = Math.min(100, Math.max(0, Math.round(rawScore * 10) / 10));
  const level = classifyLevel(score);

  const explanation =
    `Score ${score}/100 (${level}, v2): ` +
    `direct ${params.directCount}/${denom} (${directDependentsScore} pts, w=${cfg.weights.directDependents}), ` +
    `cascade ${(cascadeFraction * 100).toFixed(1)}% (${cascadeScore} pts, w=${cfg.weights.cascadeFraction}), ` +
    `depth ${params.depth} (${longestDepthScore} pts, w=${cfg.weights.longestDepth}), ` +
    `betweenness ${betweennessNorm.toFixed(3)} [${params.betweennessMode}] (${betweennessScore} pts, w=${cfg.weights.betweennessCentrality}).`;

  return {
    score,
    level,
    modelVersion: 'v2',
    breakdown: {
      directDependentsCount: params.directCount,
      directDependentsWeight: cfg.weights.directDependents,
      directDependentsScore,
      cascadeCount: params.cascadeCount,
      cascadeWeight: cfg.weights.cascadeFraction,
      cascadeScore,
      depth: params.depth,
      rawScore,
      totalNodes: params.totalNodes,
      directDependentsNormalized: directNorm,
      cascadeFraction,
      longestDepthNormalized: depthNorm,
      longestDepthScore,
      betweennessCentrality: betweennessNorm,
      betweennessScore,
      betweennessMode: params.betweennessMode,
      weights: cfg.weights,
    },
    explanation,
  };
}

/**
 * Computes Risk Model v2 for a node directly from a DAGEngine using hard edges only.
 */
export function calculateGraphRisk(
  engine: DAGEngine,
  nodeId: string,
  config?: RiskV2ConfigOverride,
  precomputedBetweenness?: BetweennessResult
): ArchitectureRiskResult {
  const cfg = resolveConfig(config);
  const totalNodes = engine.getNodeCount();
  const directCount = engine.getDirectDependents(nodeId, { includeSoft: false }).length;
  const cascadeCount = engine.getBlastRadius(nodeId, { includeSoft: false }).length;
  const depth = engine.getDepth(nodeId, { includeSoft: false });

  const betweenness =
    precomputedBetweenness ??
    computeBetweennessCentrality(engine, {
      maxExactBetweennessNodes: cfg.maxExactBetweennessNodes,
      betweennessSampleSize: cfg.betweennessSampleSize,
    });

  return calculateRiskV2FromScalars({
    directCount,
    cascadeCount,
    depth,
    totalNodes,
    betweennessCentrality: betweenness.scores.get(nodeId) ?? 0,
    betweennessMode: betweenness.mode,
    config,
  });
}

/**
 * Computes an explainable architecture risk score (0-100) and risk level.
 * Supports Risk Model v2 (default when `version: 'v2'` or `totalNodes` is provided)
 * and keeps v1 heuristic available via `version: 'v1'` (or legacy scalar calls).
 */
export function calculateArchitectureRisk(params: RiskInputParams): ArchitectureRiskResult {
  const useV2 =
    params.version === 'v2' ||
    (params.version !== 'v1' && params.totalNodes !== undefined);

  if (!useV2) {
    return calculateRiskV1(params);
  }

  const directCount = params.directDependentsCount ?? params.directDependents?.length ?? 0;
  const cascadeCount = params.cascadeCount ?? params.cascade?.length ?? 0;
  const depth = params.depth ?? 0;
  const totalNodes = params.totalNodes ?? Math.max(1, cascadeCount + 1);

  return calculateRiskV2FromScalars({
    directCount,
    cascadeCount,
    depth,
    totalNodes,
    betweennessCentrality: params.betweennessCentrality ?? 0,
    betweennessMode: params.betweennessMode ?? 'exact',
    config: params.config,
  });
}
