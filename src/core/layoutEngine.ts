import dagre from 'dagre';
import type { Node, Edge, Position } from '@xyflow/react';
import type { NirnayADR } from './types';

const NODE_WIDTH = 300;
const NODE_HEIGHT = 160;

/**
 * Calculates hierarchical top-to-bottom layout coordinates for any dynamic set of ADRs
 */
export const getLayoutedGraph = (
  adrs: NirnayADR[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  });

  // Add nodes to dagre
  adrs.forEach((adr) => {
    dagreGraph.setNode(adr.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Add edges to dagre
  const edges: Edge[] = [];
  adrs.forEach((adr) => {
    adr.dependencies.forEach((depId) => {
      dagreGraph.setEdge(depId, adr.id);
      edges.push({
        id: `e-${depId}->${adr.id}`,
        source: depId,
        target: adr.id,
        type: 'glowEdge',
      });
    });
  });

  dagre.layout(dagreGraph);

  // Map computed positions back into ReactFlow Nodes
  const nodes: Node[] = adrs.map((adr) => {
    const nodeWithPosition = dagreGraph.node(adr.id);
    return {
      id: adr.id,
      type: 'decisionNode',
      targetPosition: (direction === 'TB' ? 'top' : 'left') as Position,
      sourcePosition: (direction === 'TB' ? 'bottom' : 'right') as Position,
      position: {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      },
      data: { ...adr },
    };
  });

  return { nodes, edges };
};
