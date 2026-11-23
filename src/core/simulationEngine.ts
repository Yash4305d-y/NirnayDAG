import { DAGEngine } from './dagEngine.js';
import { calculateArchitectureRisk } from './risk.js';
import type { NirnayADR } from './types.js';

export interface SimulationResult {
  activeGraph: NirnayADR[];
  fragilityScore: number;
  orphanedNodes: string[];
  impactedNodes: string[];
}

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
    const directDependentsSet = new Set<string>();
    const impactedNodesSet = new Set<string>();
    const orphanedNodesSet = new Set<string>();

    activeGraph.forEach((adr) => {
      if (adr.status === 'deprecated') {
        const direct = dag.getDirectDependents(adr.id);
        direct.forEach((d) => directDependentsSet.add(d));
        const blast = dag.getBlastRadius(adr.id);
        
        blast.forEach((downstreamId) => {
          impactedNodesSet.add(downstreamId);
          orphanedNodesSet.add(downstreamId);
        });
      }
    });

    const risk = calculateArchitectureRisk({
      directDependentsCount: directDependentsSet.size,
      cascadeCount: impactedNodesSet.size,
    });

    return {
      activeGraph,
      fragilityScore: risk.score,
      orphanedNodes: Array.from(orphanedNodesSet),
      impactedNodes: Array.from(impactedNodesSet),
    };
  }
}
