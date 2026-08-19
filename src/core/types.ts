export type DecisionStatus = 'accepted' | 'proposed' | 'superseded' | 'deprecated';

export interface NirnayADR extends Record<string, unknown> {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  timestamp: string;
  context: string;
  decision: string;
  consequences: {
    pros: string[];
    cons: string[];
  };
  dependencies: string[];
  supersedes?: string;
}

export interface NirnayEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
  animated?: boolean;
}

export interface DAGGraph {
  nodes: Record<string, NirnayADR>;
  edges: NirnayEdge[];
  adjacencyList: Record<string, string[]>;
  reverseAdjacencyList: Record<string, string[]>;
}

export interface NirnayValidationError {
  nodeId: string;
  message: string;
  severity: "error" | "warning";
}
