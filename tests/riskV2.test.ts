import { describe, it, expect } from 'vitest';
import { DAGEngine } from '../src/core/dagEngine.js';
import type { NirnayADR } from '../src/core/types.js';
import {
  calculateArchitectureRisk,
  calculateGraphRisk,
  computeBetweennessCentrality,
  DEFAULT_RISK_V2_CONFIG,
  MAX_EXACT_BETWEENNESS_NODES,
} from '../src/core/risk.js';

function makeAdr(
  id: string,
  dependencies: string[] = [],
  options: { softDependencies?: string[]; category?: NirnayADR['category'] } = {}
): NirnayADR {
  return {
    id,
    title: `Decision ${id}`,
    category: options.category ?? 'Infrastructure',
    status: 'accepted',
    timestamp: '2026-01-01',
    context: 'Context',
    decision: 'Decision',
    consequences: { pros: [], cons: [] },
    dependencies,
    softDependencies: options.softDependencies,
  };
}

describe('Risk Model v2 (graph-based)', () => {
  it('scores an isolated node at 0 (Low) with zeroed breakdown factors', () => {
    const adrs = [makeAdr('ADR-1'), makeAdr('ADR-2')];
    const engine = new DAGEngine(adrs);
    const result = calculateGraphRisk(engine, 'ADR-1');

    expect(result.score).toBe(0);
    expect(result.level).toBe('Low');
    expect(result.modelVersion).toBe('v2');
    expect(result.breakdown.directDependentsCount).toBe(0);
    expect(result.breakdown.cascadeCount).toBe(0);
    expect(result.breakdown.cascadeFraction).toBe(0);
    expect(result.breakdown.depth).toBe(0);
    expect(result.breakdown.betweennessCentrality).toBe(0);
    expect(result.breakdown.betweennessMode).toBe('exact');
  });

  it('uses hard edges only and ignores soft dependencies', () => {
    const adrs = [
      makeAdr('ADR-1'),
      makeAdr('ADR-2', [], { softDependencies: ['ADR-1'] }),
      makeAdr('ADR-3', [], { softDependencies: ['ADR-1'] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = calculateGraphRisk(engine, 'ADR-1');

    expect(result.score).toBe(0);
    expect(result.breakdown.directDependentsCount).toBe(0);
    expect(result.breakdown.cascadeCount).toBe(0);
  });

  it('does not apply any category-based weights', () => {
    const infraEngine = new DAGEngine([
      makeAdr('ADR-1', [], { category: 'Infrastructure' }),
      makeAdr('ADR-2', ['ADR-1'], { category: 'Infrastructure' }),
    ]);
    const securityEngine = new DAGEngine([
      makeAdr('ADR-1', [], { category: 'Security' }),
      makeAdr('ADR-2', ['ADR-1'], { category: 'Security' }),
    ]);

    const infraRisk = calculateGraphRisk(infraEngine, 'ADR-1');
    const secRisk = calculateGraphRisk(securityEngine, 'ADR-1');

    expect(infraRisk.score).toBe(secRisk.score);
    expect(infraRisk.breakdown).toEqual(secRisk.breakdown);
  });

  it('computes betweenness centrality via Brandes algorithm for bridge nodes', () => {
    // Chain: ADR-1 <- ADR-2 <- ADR-3 <- ADR-4 (edges: ADR-1 -> ADR-2 -> ADR-3 -> ADR-4)
    const adrs = [
      makeAdr('ADR-1'),
      makeAdr('ADR-2', ['ADR-1']),
      makeAdr('ADR-3', ['ADR-2']),
      makeAdr('ADR-4', ['ADR-3']),
    ];
    const engine = new DAGEngine(adrs);
    const centrality = computeBetweennessCentrality(engine);

    // ADR-1 and ADR-4 are endpoints -> 0 betweenness
    expect(centrality.scores.get('ADR-1')).toBe(0);
    expect(centrality.scores.get('ADR-4')).toBe(0);
    // ADR-2 is on (1->3), (1->4) => 2 / (3*2) = 1/3
    expect(centrality.scores.get('ADR-2')).toBeCloseTo(1 / 3, 5);
    // ADR-3 is on (1->4), (2->4) => 2 / (3*2) = 1/3
    expect(centrality.scores.get('ADR-3')).toBeCloseTo(1 / 3, 5);
    expect(centrality.mode).toBe('exact');
  });

  it('respects explicit custom weights config and clamps score to [0, 100]', () => {
    const adrs = [
      makeAdr('ADR-1'),
      makeAdr('ADR-2', ['ADR-1']),
      makeAdr('ADR-3', ['ADR-1']),
    ];
    const engine = new DAGEngine(adrs);
    const customResult = calculateGraphRisk(engine, 'ADR-1', {
      weights: {
        directDependents: 0.5,
        cascadeFraction: 0.5,
        longestDepth: 0,
        betweennessCentrality: 0,
      },
    });

    // 2/2 direct = 1.0, 2/2 cascade = 1.0 => 100
    expect(customResult.score).toBe(100);
    expect(customResult.level).toBe('High');
    expect(customResult.breakdown.weights?.directDependents).toBe(0.5);
    expect(DEFAULT_RISK_V2_CONFIG.weights.directDependents).toBeGreaterThan(0);
  });

  it('falls back from exact betweenness when graph exceeds 5000 nodes threshold', () => {
    // Use a small graph with a lower maxExactBetweennessNodes override to test the fallback path fast
    const adrs = [
      makeAdr('ADR-1'),
      makeAdr('ADR-2', ['ADR-1']),
      makeAdr('ADR-3', ['ADR-2']),
      makeAdr('ADR-4', ['ADR-3']),
    ];
    const engine = new DAGEngine(adrs);
    expect(MAX_EXACT_BETWEENNESS_NODES).toBe(5000);

    const sampledResult = calculateGraphRisk(engine, 'ADR-2', {
      maxExactBetweennessNodes: 2,
      betweennessSampleSize: 2,
    });
    expect(sampledResult.breakdown.betweennessMode).toBe('sampled');
    expect(sampledResult.score).toBeGreaterThanOrEqual(0);
    expect(sampledResult.score).toBeLessThanOrEqual(100);
  });

  it('keeps v1 heuristic available behind version: "v1" option', () => {
    const v1 = calculateArchitectureRisk({
      version: 'v1',
      directDependentsCount: 2,
      cascadeCount: 3,
      depth: 2,
    });
    expect(v1.score).toBe(40);
    expect(v1.level).toBe('Medium');
    expect(v1.modelVersion).toBe('v1');
  });
});
