export type DecisionStatus = 'accepted' | 'proposed' | 'superseded' | 'deprecated';

export type EdgeKind = 'hard' | 'soft';

export type EdgeSource =
  | 'frontmatter:depends_on'
  | 'frontmatter:supersedes'
  | 'status:supersedes'
  | 'kep:replaces'
  | 'kep:superseded-by'
  | 'kep:see-also'
  | 'body:link'
  | 'body:id';

export interface ADREdgeRef {
  targetId: string;
  kind: EdgeKind;
  source: EdgeSource;
  rawText?: string;
}

export interface NirnayADR extends Record<string, unknown> {
  id: string;
  title: string;
  category: 'Infrastructure' | 'Database' | 'AI / Engine' | 'Security';
  status: DecisionStatus;
  statusSource?: 'explicit' | 'default';
  timestamp: string;
  context: string;
  decision: string;
  consequences: {
    pros: string[];
    cons: string[];
  };
  dependencies: string[];
  softDependencies?: string[];
  edgeRefs?: ADREdgeRef[];
  supersedes?: string;
  supersedesList?: string[];
  supersededBy?: string[];
  tags?: string[];
  affects?: string[];
  warnings?: string[];
  filePath?: string;
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

export type StatusSource = 'frontmatter' | 'section' | 'line' | 'kep-yaml' | 'default';

export type TitleSource = 'frontmatter' | 'heading' | 'metadata-line' | 'kep-yaml' | 'slug' | 'default';

export interface ADRFrontmatter {
  id: string;
  title: string;
  status: ADRStatus;
  statusSource?: 'explicit' | 'default';
  date: string;
  deciders?: string[];
  tags?: string[];
  depends_on?: string[];
  supersedes?: string[];
  superseded_by?: string[];
  conflicts_with?: string[];
  affects?: string[];
}

export interface ADRConsequences {
  positive: string[];
  negative: string[];
}

export type LinkClassification =
  | 'resolved'
  | 'non-decision'
  | 'outside-scope'
  | 'ambiguous'
  | 'external'
  | 'not-a-file-link'
  | 'broken';

export interface ClassifiedLink {
  rawLinkText: string;
  targetPath: string;
  classification: LinkClassification;
  resolvedId?: string;
}

export interface ParsedADR {
  frontmatter: ADRFrontmatter;
  context: string;
  decision: string;
  consequences: ADRConsequences;
  rawContent: string;
  filePath?: string;
  kepNumber?: number | string;
  titleSource?: TitleSource;
  statusSource?: StatusSource;
  edges?: ADREdgeRef[];
  links?: ClassifiedLink[];
  warnings?: string[];
}

export type BlastRadiusMap = Record<string, {
  directDependents: string[];
  totalCascade: string[];
  depth: number;
}>;
