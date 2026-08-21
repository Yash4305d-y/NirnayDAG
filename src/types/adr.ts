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

export interface DAGValidationResult {
  isValid: boolean;
  hasCycles: boolean;
  cycleNodes: string[];
  topologicalOrder: string[];
  roots: string[];
  leaves: string[];
}

export type BlastRadiusMap = Record<string, {
  directDependents: string[];
  totalCascade: string[];
  depth: number;
}>;
