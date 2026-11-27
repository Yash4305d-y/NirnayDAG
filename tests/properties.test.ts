import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DAGEngine } from '../src/core/dagEngine.js';
import { calculateGraphRisk, computeBetweennessCentrality } from '../src/core/risk.js';
import type { NirnayADR } from '../src/core/types.js';

function makeAdr(id: string, dependencies: string[]): NirnayADR {
  return {
    id,
    title: `Decision ${id}`,
    category: 'Infrastructure',
    status: 'accepted',
    timestamp: '2026-01-01',
    context: 'Context',
    decision: 'Decision',
    consequences: { pros: [], cons: [] },
    dependencies,
  };
}

/**
 * Generates an arbitrary directed graph (possibly cyclic) of N nodes (1..15)
 * as a list of NirnayADRs with hard dependencies.
 */
const arbDirectedGraph = fc
  .integer({ min: 1, max: 15 })
  .chain((n) =>
    fc
      .array(fc.tuple(fc.integer({ min: 0, max: n - 1 }), fc.integer({ min: 0, max: n - 1 })), {
        maxLength: n * 2,
      })
      .map((edges) => {
        const deps = Array.from({ length: n }, () => new Set<string>());
        for (const [u, v] of edges) {
          // v depends on u
          deps[v].add(`ADR-${u}`);
        }
        return Array.from({ length: n }, (_, i) => makeAdr(`ADR-${i}`, Array.from(deps[i])));
      })
  );

/**
 * Generates an arbitrary DAG of N nodes (2..15) where edges only go from lower index to higher index
 * (i.e. ADR-j can only depend on ADR-i if i < j), guaranteeing acyclicity.
 */
const arbDAG = fc
  .integer({ min: 2, max: 15 })
  .chain((n) =>
    fc
      .array(fc.tuple(fc.integer({ min: 0, max: n - 1 }), fc.integer({ min: 0, max: n - 1 })), {
        maxLength: n * 2,
      })
      .map((pairs) => {
        const deps = Array.from({ length: n }, () => new Set<string>());
        for (const [a, b] of pairs) {
          if (a === b) continue;
          const parent = Math.min(a, b);
          const child = Math.max(a, b);
          deps[child].add(`ADR-${parent}`);
        }
        return Array.from({ length: n }, (_, i) => makeAdr(`ADR-${i}`, Array.from(deps[i])));
      })
  );

describe('Property-based tests (fast-check)', () => {
  it('(a) topological order exists iff hard-edge cycle detection finds no cycle', () => {
    fc.assert(
      fc.property(arbDirectedGraph, (adrs) => {
        const engine = new DAGEngine(adrs);
        const result = engine.validate();

        if (result.hasCycle) {
          expect(result.topologicalOrder.length).toBeLessThan(adrs.length);
        } else {
          expect(result.topologicalOrder.length).toBe(adrs.length);
        }
      }),
      { numRuns: 150 }
    );
  });

  it('(b) in any topological order, every hard edge goes forward (dependency before dependent)', () => {
    fc.assert(
      fc.property(arbDAG, (adrs) => {
        const engine = new DAGEngine(adrs);
        const result = engine.validate();
        expect(result.hasCycle).toBe(false);

        const pos = new Map<string, number>();
        result.topologicalOrder.forEach((id, idx) => pos.set(id, idx));

        for (const adr of adrs) {
          for (const depId of adr.dependencies) {
            expect(pos.get(depId)!).toBeLessThan(pos.get(adr.id)!);
          }
        }
      }),
      { numRuns: 150 }
    );
  });

  it('(c) cascade size of a node is never smaller than its direct dependents', () => {
    fc.assert(
      fc.property(arbDirectedGraph, (adrs) => {
        const engine = new DAGEngine(adrs);
        for (const adr of adrs) {
          const direct = engine.getDirectDependents(adr.id);
          const cascade = engine.getBlastRadius(adr.id);
          expect(cascade.length).toBeGreaterThanOrEqual(direct.length);
          for (const d of direct) {
            expect(cascade).toContain(d);
          }
        }
      }),
      { numRuns: 150 }
    );
  });

  it('(d) risk v2 score stays within 0-100 and does not decrease when a new dependent is added', () => {
    fc.assert(
      fc.property(
        arbDAG.chain((adrs) =>
          fc.tuple(fc.constant(adrs), fc.integer({ min: 0, max: adrs.length - 1 }))
        ),
        ([adrs, targetIdx]) => {
          const targetId = `ADR-${targetIdx}`;
          const engineBefore = new DAGEngine(adrs);
          const betweennessBefore = computeBetweennessCentrality(engineBefore);
          const riskBefore = calculateGraphRisk(engineBefore, targetId, undefined, betweennessBefore);

          expect(riskBefore.score).toBeGreaterThanOrEqual(0);
          expect(riskBefore.score).toBeLessThanOrEqual(100);

          // Add a new leaf dependent node depending on targetId
          const newAdr = makeAdr(`ADR-NEW-${adrs.length}`, [targetId]);
          const engineAfter = new DAGEngine([...adrs, newAdr]);
          const betweennessAfter = computeBetweennessCentrality(engineAfter);
          const riskAfter = calculateGraphRisk(engineAfter, targetId, undefined, betweennessAfter);

          expect(riskAfter.score).toBeGreaterThanOrEqual(0);
          expect(riskAfter.score).toBeLessThanOrEqual(100);
          expect(riskAfter.score).toBeGreaterThanOrEqual(riskBefore.score);
        }
      ),
      { numRuns: 150 }
    );
  });
});
