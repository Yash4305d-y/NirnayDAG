import { describe, it, expect } from 'vitest';
import { calculateArchitectureRisk } from '../src/core/risk.js';

describe('Architecture Risk Calculation (src/core/risk.ts)', () => {
  it('should calculate zero risk for a node with no dependents', () => {
    const result = calculateArchitectureRisk({
      directDependentsCount: 0,
      cascadeCount: 0,
      depth: 0,
    });

    expect(result.score).toBe(0);
    expect(result.level).toBe('Low');
    expect(result.breakdown.directDependentsScore).toBe(0);
    expect(result.breakdown.cascadeScore).toBe(0);
    expect(result.breakdown.rawScore).toBe(0);
    expect(result.explanation).toContain('Score 0/100 (Low)');
  });

  it('should calculate heuristic risk using current weights (direct*5 + cascade*10)', () => {
    // 2 direct dependents (2 * 5 = 10), 3 cascading descendants (3 * 10 = 30) => total 40
    const result = calculateArchitectureRisk({
      directDependentsCount: 2,
      cascadeCount: 3,
      depth: 2,
    });

    expect(result.score).toBe(40);
    expect(result.level).toBe('Medium');
    expect(result.breakdown.directDependentsScore).toBe(10);
    expect(result.breakdown.cascadeScore).toBe(30);
    expect(result.breakdown.rawScore).toBe(40);
    expect(result.breakdown.depth).toBe(2);
    expect(result.explanation).toContain('Score 40/100 (Medium)');
  });

  it('should cap risk score at 100 with High level when saturation is reached', () => {
    // 10 direct (50), 10 cascade (100) => raw 150, capped at 100
    const result = calculateArchitectureRisk({
      directDependentsCount: 10,
      cascadeCount: 10,
      depth: 4,
    });

    expect(result.score).toBe(100);
    expect(result.level).toBe('High');
    expect(result.breakdown.rawScore).toBe(150);
    expect(result.explanation).toContain('Score 100/100 (High)');
  });

  it('should return an explainable breakdown object with factors and explanation text', () => {
    const result = calculateArchitectureRisk({
      directDependentsCount: 1,
      cascadeCount: 1,
    });

    expect(result.breakdown).toBeDefined();
    expect(result.breakdown.directDependentsWeight).toBe(5);
    expect(result.breakdown.cascadeWeight).toBe(10);
    expect(result.explanation).toMatch(/direct dependent/i);
    expect(result.explanation).toMatch(/cascading/i);
  });

  it('should correctly classify risk levels at boundaries', () => {
    // score <= 30 is Low
    expect(calculateArchitectureRisk({ directDependentsCount: 6, cascadeCount: 0 }).level).toBe('Low'); // 30
    // score 31..60 is Medium
    expect(calculateArchitectureRisk({ directDependentsCount: 7, cascadeCount: 0 }).level).toBe('Medium'); // 35
    expect(calculateArchitectureRisk({ directDependentsCount: 0, cascadeCount: 6 }).level).toBe('Medium'); // 60
    // score > 60 is High
    expect(calculateArchitectureRisk({ directDependentsCount: 1, cascadeCount: 6 }).level).toBe('High'); // 65
  });

  it('should accept arrays of node IDs for ergonomic caller usage', () => {
    const result = calculateArchitectureRisk({
      directDependents: ['DEP-1', 'DEP-2'],
      cascade: ['DEP-1', 'DEP-2', 'LEAF-1'],
      depth: 2,
    });

    expect(result.score).toBe(40);
    expect(result.breakdown.directDependentsCount).toBe(2);
    expect(result.breakdown.cascadeCount).toBe(3);
  });
});
