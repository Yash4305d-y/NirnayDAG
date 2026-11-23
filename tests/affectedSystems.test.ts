import { describe, it, expect } from 'vitest';
import { DAGEngine, mapParsedToNirnay } from '../src/core/dagEngine.js';
import type { NirnayADR, ParsedADR } from '../src/core/types.js';

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
    tags: [],
    ...overrides,
  };
}

describe('Affected Systems Grouping by ADR Tags', () => {
  it('should preserve frontmatter tags when mapping parsed ADR to NirnayADR', () => {
    const parsed: ParsedADR = {
      frontmatter: {
        id: 'ADR-100',
        title: 'Auth Service',
        status: 'accepted',
        date: '2026-01-01',
        tags: ['auth', 'identity'],
        depends_on: [],
      },
      context: 'Context',
      decision: 'Decision',
      consequences: { positive: [], negative: [] },
    };

    const mapped = mapParsedToNirnay(parsed);
    expect(mapped.tags).toEqual(['auth', 'identity']);
  });

  it('should group cascade nodes by tags into affected systems', () => {
    const adrs = [
      createMockAdr({ id: 'ROOT', dependencies: [], tags: ['core'] }),
      createMockAdr({ id: 'SVC-AUTH', dependencies: ['ROOT'], tags: ['security', 'auth'] }),
      createMockAdr({ id: 'SVC-BILLING', dependencies: ['ROOT'], tags: ['payments'] }),
      createMockAdr({ id: 'SVC-CHECKOUT', dependencies: ['SVC-BILLING'], tags: ['payments', 'cart'] }),
    ];

    const engine = new DAGEngine(adrs);
    const affected = engine.getAffectedSystems('ROOT');

    expect(affected).toEqual({
      security: ['SVC-AUTH'],
      auth: ['SVC-AUTH'],
      payments: ['SVC-BILLING', 'SVC-CHECKOUT'],
      cart: ['SVC-CHECKOUT'],
    });
  });

  it('should place ADRs with missing or empty tags into untagged group', () => {
    const adrs = [
      createMockAdr({ id: 'ROOT', dependencies: [] }),
      createMockAdr({ id: 'CHILD-NO-TAGS', dependencies: ['ROOT'], tags: [] }),
      createMockAdr({ id: 'CHILD-TAGGED', dependencies: ['ROOT'], tags: ['database'] }),
    ];

    const engine = new DAGEngine(adrs);
    const affected = engine.getAffectedSystems('ROOT');

    expect(affected).toEqual({
      untagged: ['CHILD-NO-TAGS'],
      database: ['CHILD-TAGGED'],
    });
  });

  it('should return empty affected systems when cascade is empty', () => {
    const adrs = [
      createMockAdr({ id: 'LEAF', dependencies: [], tags: ['frontend'] }),
    ];

    const engine = new DAGEngine(adrs);
    const affected = engine.getAffectedSystems('LEAF');

    expect(affected).toEqual({});
  });

  it('should allow grouping an arbitrary list of node IDs via groupNodesBySystem', () => {
    const adrs = [
      createMockAdr({ id: 'A', tags: ['infra'] }),
      createMockAdr({ id: 'B', tags: ['infra', 'cloud'] }),
      createMockAdr({ id: 'C', tags: ['ui'] }),
    ];

    const engine = new DAGEngine(adrs);
    const grouped = engine.groupNodesBySystem(['A', 'B', 'C']);

    expect(grouped).toEqual({
      infra: ['A', 'B'],
      cloud: ['B'],
      ui: ['C'],
    });
  });

  it('should handle unknown node IDs gracefully in groupNodesBySystem without throwing', () => {
    const adrs = [
      createMockAdr({ id: 'A', tags: ['infra'] }),
    ];
    const engine = new DAGEngine(adrs);
    const grouped = engine.groupNodesBySystem(['A', 'NONEXISTENT']);
    expect(grouped).toEqual({
      infra: ['A'],
      untagged: ['NONEXISTENT'],
    });
  });

  it('should not duplicate node IDs within the same system tag if listed multiple times', () => {
    const adrs = [
      createMockAdr({ id: 'A', tags: ['infra', 'infra'] }),
    ];
    const engine = new DAGEngine(adrs);
    const grouped = engine.groupNodesBySystem(['A', 'A']);
    expect(grouped).toEqual({
      infra: ['A'],
    });
  });
});
