import { describe, it, expect } from 'vitest';
import { DAGEngine } from '../src/core/dagEngine.js';
import type { NirnayADR } from '../src/core/types.js';

function createMockAdr(overrides?: Partial<NirnayADR>): NirnayADR {
  return {
    id: 'ADR-001',
    title: 'Test ADR',
    category: 'Infrastructure',
    status: 'accepted',
    timestamp: '2026-01-01',
    context: 'Test Context',
    decision: 'Test Decision',
    consequences: { pros: [], cons: [] },
    dependencies: [],
    ...overrides,
  };
}

describe('DAGEngine', () => {
  it('should resolve a valid linear graph in topological order', () => {
    const adrs = [
      createMockAdr({ id: 'ADR-003', dependencies: ['ADR-002'] }),
      createMockAdr({ id: 'ADR-001', dependencies: [] }),
      createMockAdr({ id: 'ADR-002', dependencies: ['ADR-001'] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = engine.validate();
    expect(result.isValid).toBe(true);
    expect(result.topologicalOrder).toEqual(['ADR-001', 'ADR-002', 'ADR-003']);
  });

  it('should resolve branching & merging (Diamond Dependency)', () => {
    const adrs = [
      createMockAdr({ id: 'ADR-004', dependencies: ['ADR-002', 'ADR-003'] }),
      createMockAdr({ id: 'ADR-002', dependencies: ['ADR-001'] }),
      createMockAdr({ id: 'ADR-003', dependencies: ['ADR-001'] }),
      createMockAdr({ id: 'ADR-001', dependencies: [] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = engine.validate();
    expect(result.isValid).toBe(true);
    expect(result.topologicalOrder.indexOf('ADR-004')).toBeGreaterThan(result.topologicalOrder.indexOf('ADR-002'));
    expect(result.topologicalOrder.indexOf('ADR-004')).toBeGreaterThan(result.topologicalOrder.indexOf('ADR-003'));
  });

  it('should detect a direct cycle', () => {
    const adrs = [
      createMockAdr({ id: 'ADR-001', dependencies: ['ADR-002'] }),
      createMockAdr({ id: 'ADR-002', dependencies: ['ADR-001'] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = engine.validate();
    expect(result.isValid).toBe(false);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath![0]).toBe(result.cyclePath![result.cyclePath!.length - 1]);
    expect(result.cyclePath).toEqual(['ADR-001', 'ADR-002', 'ADR-001']);
  });

  it('should detect a self-referential cycle', () => {
    const adrs = [
      createMockAdr({ id: 'ADR-001', dependencies: ['ADR-001'] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = engine.validate();
    expect(result.isValid).toBe(false);
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toEqual(['ADR-001', 'ADR-001']);
  });

  describe('Cycle Path Extraction (Pure Cycle)', () => {
    it('should return only cycle nodes when reachable from a non-cyclic prefix', () => {
      // ADR-0001 -> ADR-0002 -> ADR-0004 -> ADR-0006 -> ADR-0004
      const adrs = [
        createMockAdr({ id: 'ADR-0001', dependencies: [] }),
        createMockAdr({ id: 'ADR-0002', dependencies: ['ADR-0001'] }),
        createMockAdr({ id: 'ADR-0004', dependencies: ['ADR-0002', 'ADR-0006'] }),
        createMockAdr({ id: 'ADR-0006', dependencies: ['ADR-0004'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();
      expect(result.cyclePath![0]).toBe(result.cyclePath![result.cyclePath!.length - 1]);
      // Should NOT contain ADR-0001 or ADR-0002 from the prefix
      expect(result.cyclePath).not.toContain('ADR-0001');
      expect(result.cyclePath).not.toContain('ADR-0002');
      expect(result.cyclePath).toEqual(['ADR-0004', 'ADR-0006', 'ADR-0004']);
    });

    it('should return only self-loop node when self-loop is reachable from a non-cyclic prefix', () => {
      // ADR-0001 -> ADR-0002 (with ADR-0002 depending on itself)
      const adrs = [
        createMockAdr({ id: 'ADR-0001', dependencies: [] }),
        createMockAdr({ id: 'ADR-0002', dependencies: ['ADR-0001', 'ADR-0002'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toEqual(['ADR-0002', 'ADR-0002']);
    });

    it('should return only one pure cycle when graph contains two separate cycles', () => {
      // Disjoint Cycle 1 (ADR-010 <-> ADR-011) and Cycle 2 (ADR-020 <-> ADR-021)
      const adrs = [
        createMockAdr({ id: 'PREFIX-1', dependencies: [] }),
        createMockAdr({ id: 'ADR-010', dependencies: ['PREFIX-1', 'ADR-011'] }),
        createMockAdr({ id: 'ADR-011', dependencies: ['ADR-010'] }),
        createMockAdr({ id: 'PREFIX-2', dependencies: [] }),
        createMockAdr({ id: 'ADR-020', dependencies: ['PREFIX-2', 'ADR-021'] }),
        createMockAdr({ id: 'ADR-021', dependencies: ['ADR-020'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();

      const path = result.cyclePath!;
      // Starts and ends at the same node
      expect(path[0]).toBe(path[path.length - 1]);
      // Should not contain prefix nodes
      expect(path).not.toContain('PREFIX-1');
      expect(path).not.toContain('PREFIX-2');

      // Must be entirely Cycle 1 OR entirely Cycle 2, never mixing nodes from both
      const isCycle1 = path.every((node) => ['ADR-010', 'ADR-011'].includes(node));
      const isCycle2 = path.every((node) => ['ADR-020', 'ADR-021'].includes(node));
      expect(isCycle1 || isCycle2).toBe(true);
    });
  });

  it('should detect missing dependencies', () => {
    const adrs = [
      createMockAdr({ id: 'ADR-002', dependencies: ['ADR-999'] }),
    ];
    const engine = new DAGEngine(adrs);
    const result = engine.validate();
    expect(result.isValid).toBe(false);
    expect(result.missingDependencies.length).toBe(1);
    expect(result.missingDependencies[0]).toEqual({ adrId: 'ADR-002', missingId: 'ADR-999' });
  });

  describe('Blast Radius Computation', () => {
    const adrs = [
      createMockAdr({ id: 'ROOT', dependencies: [] }),
      createMockAdr({ id: 'MID-1', dependencies: ['ROOT'] }),
      createMockAdr({ id: 'MID-2', dependencies: ['ROOT'] }),
      createMockAdr({ id: 'LEAF-1', dependencies: ['MID-1'] }),
      createMockAdr({ id: 'ISLAND-1', dependencies: [] }),
      createMockAdr({ id: 'ISLAND-2', dependencies: ['ISLAND-1'] }),
    ];
    const engine = new DAGEngine(adrs);

    it('should compute blast radius correctly for root node affecting descendants', () => {
      const impacted = engine.getBlastRadius('ROOT');
      expect(impacted).toContain('MID-1');
      expect(impacted).toContain('MID-2');
      expect(impacted).toContain('LEAF-1');
      expect(impacted).not.toContain('ISLAND-1');
      expect(impacted).not.toContain('ISLAND-2');
      expect(impacted.length).toBe(3);
    });

    it('should return empty blast radius for leaf node', () => {
      const impacted = engine.getBlastRadius('LEAF-1');
      expect(impacted).toEqual([]);
    });

    it('should not leak blast radius across disconnected island graphs', () => {
      const impacted = engine.getBlastRadius('ISLAND-1');
      expect(impacted).toEqual(['ISLAND-2']);
    });

    it('regression: a root ADR with 3 dependents and 0 dependencies must report 3 direct dependents; a leaf with 5 dependencies must report 0', () => {
      const testAdrs = [
        createMockAdr({ id: 'ROOT', dependencies: [] }),
        createMockAdr({ id: 'DEP-1', dependencies: ['ROOT'] }),
        createMockAdr({ id: 'DEP-2', dependencies: ['ROOT'] }),
        createMockAdr({ id: 'DEP-3', dependencies: ['ROOT'] }),
        createMockAdr({ id: 'EXT-1', dependencies: [] }),
        createMockAdr({ id: 'EXT-2', dependencies: [] }),
        createMockAdr({ id: 'LEAF', dependencies: ['DEP-1', 'DEP-2', 'DEP-3', 'EXT-1', 'EXT-2'] }),
      ];
      const testEngine = new DAGEngine(testAdrs);

      // Root ADR has 3 dependents and 0 dependencies
      expect(testEngine.getDirectDependents('ROOT')).toEqual(['DEP-1', 'DEP-2', 'DEP-3']);
      expect(testEngine.getDirectDependencies('ROOT')).toEqual([]);

      // Leaf ADR has 5 dependencies and 0 dependents
      expect(testEngine.getDirectDependents('LEAF')).toEqual([]);
      expect(testEngine.getDirectDependencies('LEAF')).toEqual(['DEP-1', 'DEP-2', 'DEP-3', 'EXT-1', 'EXT-2']);
    });
  });

  describe('Graph Depth & Cascade Level Computation', () => {
    it('should compute depth and levels for a linear chain graph', () => {
      // Chain: A -> B -> C -> D (D depends on C, C depends on B, B depends on A)
      const adrs = [
        createMockAdr({ id: 'A', dependencies: [] }),
        createMockAdr({ id: 'B', dependencies: ['A'] }),
        createMockAdr({ id: 'C', dependencies: ['B'] }),
        createMockAdr({ id: 'D', dependencies: ['C'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getDepth('A')).toBe(3);
      expect(engine.getCascadeLevels('A')).toEqual({ B: 1, C: 2, D: 3 });
      expect(engine.getDepth('B')).toBe(2);
      expect(engine.getCascadeLevels('B')).toEqual({ C: 1, D: 2 });
      expect(engine.getDepth('D')).toBe(0);
      expect(engine.getCascadeLevels('D')).toEqual({});
    });

    it('should compute depth and levels for a diamond graph', () => {
      // Diamond: A -> B -> D, A -> C -> D
      const adrs = [
        createMockAdr({ id: 'A', dependencies: [] }),
        createMockAdr({ id: 'B', dependencies: ['A'] }),
        createMockAdr({ id: 'C', dependencies: ['A'] }),
        createMockAdr({ id: 'D', dependencies: ['B', 'C'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getDepth('A')).toBe(2);
      expect(engine.getCascadeLevels('A')).toEqual({ B: 1, C: 1, D: 2 });
    });

    it('should compute depth and levels for a wide fan-out graph', () => {
      // Wide fan-out: A -> B, A -> C, A -> D, A -> E
      const adrs = [
        createMockAdr({ id: 'A', dependencies: [] }),
        createMockAdr({ id: 'B', dependencies: ['A'] }),
        createMockAdr({ id: 'C', dependencies: ['A'] }),
        createMockAdr({ id: 'D', dependencies: ['A'] }),
        createMockAdr({ id: 'E', dependencies: ['A'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getDepth('A')).toBe(1);
      expect(engine.getCascadeLevels('A')).toEqual({ B: 1, C: 1, D: 1, E: 1 });
    });

    it('should terminate safely and compute depth without infinite recursion on a cyclic graph', () => {
      // Cycle: A -> B -> C -> A
      const adrs = [
        createMockAdr({ id: 'A', dependencies: ['C'] }),
        createMockAdr({ id: 'B', dependencies: ['A'] }),
        createMockAdr({ id: 'C', dependencies: ['B'] }),
      ];
      const engine = new DAGEngine(adrs);
      // Traversal must terminate safely and not throw RangeError (Maximum call stack size exceeded)
      const depth = engine.getDepth('A');
      expect(typeof depth).toBe('number');
      expect(depth).toBeGreaterThanOrEqual(1);
      const levels = engine.getCascadeLevels('A');
      expect(levels).toBeDefined();
    });
  });

  describe('Root Nodes (getRoots)', () => {
    it('should identify all root decisions that have no upstream dependencies', () => {
      const adrs = [
        createMockAdr({ id: 'ROOT-1', dependencies: [] }),
        createMockAdr({ id: 'ROOT-2', dependencies: [] }),
        createMockAdr({ id: 'MID', dependencies: ['ROOT-1'] }),
        createMockAdr({ id: 'LEAF', dependencies: ['MID', 'ROOT-2'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getRoots()).toEqual(['ROOT-1', 'ROOT-2']);
    });

    it('should return empty roots array if graph has only self-referential or closed cycles', () => {
      const adrs = [
        createMockAdr({ id: 'CYC-1', dependencies: ['CYC-2'] }),
        createMockAdr({ id: 'CYC-2', dependencies: ['CYC-1'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getRoots()).toEqual([]);
    });

    it('should return roots for valid island when another island is cyclic', () => {
      const adrs = [
        createMockAdr({ id: 'ISLAND-ROOT', dependencies: [] }),
        createMockAdr({ id: 'ISLAND-LEAF', dependencies: ['ISLAND-ROOT'] }),
        createMockAdr({ id: 'CYC-1', dependencies: ['CYC-2'] }),
        createMockAdr({ id: 'CYC-2', dependencies: ['CYC-1'] }),
      ];
      const engine = new DAGEngine(adrs);
      expect(engine.getRoots()).toEqual(['ISLAND-ROOT']);
    });
  });

  describe('DAGEngine Defensive Edge Cases', () => {
    it('should return empty arrays for getDirectDependents and getDirectDependencies with unknown ID', () => {
      const engine = new DAGEngine([]);
      expect(engine.getDirectDependents('NONEXISTENT')).toEqual([]);
      expect(engine.getDirectDependencies('NONEXISTENT')).toEqual([]);
    });

    it('should return 0 depth and empty cascade levels for unknown ID', () => {
      const engine = new DAGEngine([]);
      expect(engine.getDepth('NONEXISTENT')).toBe(0);
      expect(engine.getCascadeLevels('NONEXISTENT')).toEqual({});
    });
  });

  describe('Hard vs Soft Edges (Phase 2B)', () => {
    it('(a) still detects a real hard cycle even when soft edges exist', () => {
      const adrs = [
        createMockAdr({ id: 'ADR-001', dependencies: ['ADR-002'], softDependencies: ['ADR-003'] }),
        createMockAdr({ id: 'ADR-002', dependencies: ['ADR-001'] }),
        createMockAdr({ id: 'ADR-003', dependencies: [], softDependencies: ['ADR-001'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toEqual(['ADR-001', 'ADR-002', 'ADR-001']);
    });

    it('(b) does not fail validation for two ADRs with soft mutual references only', () => {
      const adrs = [
        createMockAdr({ id: 'ADR-0008', dependencies: [], softDependencies: ['ADR-0013'] }),
        createMockAdr({ id: 'ADR-0013', dependencies: [], softDependencies: ['ADR-0008'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(true);
      expect(result.hasCycle).toBe(false);
      expect(result.cyclePath).toBeUndefined();
      expect(result.topologicalOrder).toEqual(['ADR-0008', 'ADR-0013']);
      expect(result.mutualReferences).toEqual([
        { pair: ['ADR-0008', 'ADR-0013'] },
      ]);
    });

    it('(c) keeps blast radius, depth, and direct dependents unchanged by soft links unless includeSoft is true', () => {
      const adrs = [
        createMockAdr({ id: 'ADR-001', dependencies: [], tags: ['core'] }),
        createMockAdr({ id: 'ADR-002', dependencies: ['ADR-001'], tags: ['api'] }),
        createMockAdr({ id: 'ADR-003', dependencies: ['ADR-002'], tags: ['db'] }),
        createMockAdr({ id: 'ADR-004', dependencies: [], softDependencies: ['ADR-001'], tags: ['docs'] }),
        createMockAdr({ id: 'ADR-005', dependencies: ['ADR-004'], tags: ['ui'] }),
      ];
      const engine = new DAGEngine(adrs);

      // Default (hard edges only)
      expect(engine.getDirectDependents('ADR-001')).toEqual(['ADR-002']);
      expect(engine.getBlastRadius('ADR-001')).toEqual(['ADR-002', 'ADR-003']);
      expect(engine.getDepth('ADR-001')).toBe(2);
      expect(engine.getAffectedSystems('ADR-001')).toEqual({ api: ['ADR-002'], db: ['ADR-003'] });
      expect(engine.getSoftDependents('ADR-001')).toEqual(['ADR-004']);

      // With includeSoft: true
      expect(engine.getDirectDependents('ADR-001', { includeSoft: true })).toEqual(['ADR-002', 'ADR-004']);
      expect(engine.getBlastRadius('ADR-001', { includeSoft: true })).toEqual(['ADR-002', 'ADR-004', 'ADR-003', 'ADR-005']);
      expect(engine.getDepth('ADR-001', { includeSoft: true })).toBe(2);
      expect(engine.getAffectedSystems('ADR-001', { includeSoft: true })).toEqual({
        api: ['ADR-002'],
        db: ['ADR-003'],
        docs: ['ADR-004'],
        ui: ['ADR-005'],
      });
    });

    it('does not fail validation on missing soft references', () => {
      const adrs = [
        createMockAdr({ id: 'ADR-001', dependencies: [], softDependencies: ['ADR-999'] }),
      ];
      const engine = new DAGEngine(adrs);
      const result = engine.validate();
      expect(result.isValid).toBe(true);
      expect(result.missingDependencies).toEqual([]);
      expect(result.missingSoftReferences).toEqual([{ adrId: 'ADR-001', missingId: 'ADR-999' }]);
    });
  });
});
