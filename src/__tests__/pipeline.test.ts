import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseBatchADRs } from '../core/adrParser.js';
import { validateAndComputeDAG } from '../core/dagEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('NirnayDAG Pipeline Integration Tests', () => {
  it('should parse ADRs, build DAG, check topological sort, and detect cycles', () => {
    const sampleDir = path.resolve(__dirname, '../../sample-adrs');
    const files = fs.readdirSync(sampleDir)
      .filter(f => f.endsWith('.md'))
      .map(name => ({
        name,
        content: fs.readFileSync(path.join(sampleDir, name), 'utf-8')
      }));
      
    // 1. Test parseBatchADRs
    const parsedADRs = parseBatchADRs(files);
    expect(parsedADRs.length).toBe(6);
    
    // Check parsed extraction
    const adr1 = parsedADRs.find(a => a.frontmatter.id === 'ADR-0001');
    expect(adr1).toBeDefined();
    expect(adr1?.frontmatter.title).toBe('Microservices Core Architecture');
    expect(adr1?.context).toContain('We need a scalable architecture.');
    expect(adr1?.decision).toContain('Adopt a microservices core architecture.');
    expect(adr1?.consequences.positive).toContain('Better scalability');
    
    // 2. Test DAG without cycle (exclude ADR-0006 for valid run)
    const validADRs = parsedADRs.filter(a => a.frontmatter.id !== 'ADR-0006');
    // Remove the ADR-0006 dependency from ADR-0004 for the valid test case
    const safeValidADRs = JSON.parse(JSON.stringify(validADRs));
    const adr4Safe = safeValidADRs.find((a: any) => a.frontmatter.id === 'ADR-0004');
    adr4Safe.frontmatter.depends_on = adr4Safe.frontmatter.depends_on.filter((d: string) => d !== 'ADR-0006');
    
    const { validationResult: validResult, engine: validEngine } = validateAndComputeDAG(safeValidADRs);
    
    // Topological sort & valid graph
    expect(validResult.isValid).toBe(true);
    expect(validResult.hasCycle).toBe(false);
    expect(validResult.topologicalOrder.length).toBe(5);
    
    // Verify root detection identifies ADR-0001 and ADR-0005
    const roots = safeValidADRs
      .filter((a: any) => !a.frontmatter.depends_on || a.frontmatter.depends_on.length === 0)
      .map((a: any) => a.frontmatter.id);
    expect(roots).toContain('ADR-0001');
    expect(roots).toContain('ADR-0005');
    
    // Verify blast radius computation
    const blastRadius = validEngine.getBlastRadius('ADR-0001');
    expect(blastRadius).toContain('ADR-0002');
    expect(blastRadius).toContain('ADR-0003');
    expect(blastRadius).toContain('ADR-0004');
    
    // 3. Test Cycle Detection (include ADR-0006)
    const { validationResult: cycleResult } = validateAndComputeDAG(parsedADRs);
    expect(cycleResult.isValid).toBe(false);
    expect(cycleResult.hasCycle).toBe(true);
    expect(cycleResult.cyclePath).toBeDefined();
    
    // Path should contain ADR-0004 and ADR-0006
    expect(cycleResult.cyclePath).toContain('ADR-0004');
    expect(cycleResult.cyclePath).toContain('ADR-0006');
  });
});
