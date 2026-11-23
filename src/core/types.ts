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

export type ADRStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded' | 'rejected';

export interface ADRFrontmatter {
  id: string;
  title: string;
  status: ADRStatus;
  date: string;
  deciders?: string[];
  tags?: string[];
  depends_on?: string[];
  supersedes?: string[];
  conflicts_with?: string[];
}

export interface ADRConsequences {
  positive: string[];
  negative: string[];
}

export interface ParsedADR {
  frontmatter: ADRFrontmatter;
  context: string;
  decision: string;
  consequences: ADRConsequences;
  rawContent: string;
}

export type BlastRadiusMap = Record<string, {
  directDependents: string[];
  totalCascade: string[];
  depth: number;
}>;
