import { DAGEngine } from './dagEngine.js';
import type { NirnayADR } from './types.js';

export interface SimulationResult {
  activeGraph: NirnayADR[];
  fragilityScore: number;
  orphanedNodes: string[];
  impactedNodes: string[];
}

const CATEGORY_WEIGHTS: Record<string, number> = {
  'Infrastructure': 10,
  'Security': 10,
  'Database': 8,
  'AI / Engine': 5,
};

export class SimulationEngine {
  public static compute(
    baseAdrs: NirnayADR[],
    overrides: Record<string, Partial<NirnayADR>>,
    virtualNodes: NirnayADR[],
    virtualEdges: { source: string; target: string }[]
  ): SimulationResult {
    const activeGraph: NirnayADR[] = baseAdrs.map((adr) => {
      if (overrides[adr.id]) {
        return { ...adr, ...overrides[adr.id] };
      }
      return adr;
    });

    activeGraph.push(...virtualNodes);

    virtualEdges.forEach(({ source, target }) => {
      const targetNode = activeGraph.find((n) => n.id === target);
      if (targetNode && !targetNode.dependencies.includes(source)) {
        targetNode.dependencies.push(source);
      }
    });

    const dag = new DAGEngine(activeGraph);
    let totalScore = 0;
    const impactedNodesSet = new Set<string>();
    const orphanedNodesSet = new Set<string>();

    activeGraph.forEach((adr) => {
      if (adr.status === 'deprecated') {
        const blast = dag.getBlastRadius(adr.id);
        
        blast.forEach((downstreamId) => {
          impactedNodesSet.add(downstreamId);
          orphanedNodesSet.add(downstreamId);
          
          const downstreamNode = activeGraph.find((n) => n.id === downstreamId);
          if (downstreamNode) {
            const weight = CATEGORY_WEIGHTS[downstreamNode.category] || 5;
            totalScore += weight;
          }
        });
      }
    });

    const normalizedScore = Math.min(Math.round((totalScore / 50) * 100), 100);

    return {
      activeGraph,
      fragilityScore: normalizedScore,
      orphanedNodes: Array.from(orphanedNodesSet),
      impactedNodes: Array.from(impactedNodesSet),
    };
  }
}
