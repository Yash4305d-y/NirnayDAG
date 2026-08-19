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
    expect(result.cyclePath!.length).toBeGreaterThan(0);
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
  });
});
