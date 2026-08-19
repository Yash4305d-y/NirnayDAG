export type ADRStatus = "proposed" | "accepted" | "superseded" | "deprecated";

export interface NirnayNode {
  id: string;
  title: string;
  status: ADRStatus;
  timestamp: string; // ISO-8601
  context: string;
  decision: string;
  consequences: {
    positive: string[];
    negative: string[];
  };
  dependencies: string[];
  supersedes?: string;
}

export interface NirnayEdge {
  id: string;
  source: string;
  target: string;
  type?: string; // e.g., 'dependency', 'supersedes'
  label?: string;
  animated?: boolean;
}

export interface DAGGraph {
  nodes: Record<string, NirnayNode>;
  edges: NirnayEdge[];
  adjacencyList: Record<string, string[]>;
  reverseAdjacencyList: Record<string, string[]>; // useful for tracing upstream
}

export interface NirnayValidationError {
  nodeId: string;
  message: string;
  severity: "error" | "warning";
}
