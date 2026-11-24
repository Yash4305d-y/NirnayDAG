import type { NirnayADR, ParsedADR } from './types.js';

export interface DuplicateIdError {
  id: string;
  files: string[];
}

export interface DAGQueryOptions {
  includeSoft?: boolean;
}

export interface MutualReference {
  pair: [string, string];
}

export interface DAGValidationResult {
  isValid: boolean;
  hasCycle: boolean;
  cyclePath?: string[];
  missingDependencies: { adrId: string; missingId: string }[];
  duplicateIds: DuplicateIdError[];
  topologicalOrder: string[];
  mutualReferences?: MutualReference[];
  missingSoftReferences?: { adrId: string; missingId: string }[];
}

export class DAGEngine {
  private adrs: Map<string, NirnayADR>;
  private duplicateIds: DuplicateIdError[];
  private adjacencyList: Map<string, string[]>; // hard dependency -> dependents (forward)
  private reverseAdjacencyList: Map<string, string[]>; // hard dependent -> dependencies (backward)
  private softAdjacencyList: Map<string, string[]>; // soft target -> referencing nodes (forward)
  private softReverseAdjacencyList: Map<string, string[]>; // referencing node -> soft targets (backward)

  constructor(adrs: NirnayADR[]) {
    this.adrs = new Map();
    const idOccurrences = new Map<string, string[]>();

    for (const adr of adrs) {
      const fileLabel = adr.filePath || '<unknown>';
      const list = idOccurrences.get(adr.id);
      if (list) {
        list.push(fileLabel);
      } else {
        idOccurrences.set(adr.id, [fileLabel]);
        this.adrs.set(adr.id, adr);
      }
    }

    this.duplicateIds = Array.from(idOccurrences.entries())
      .filter(([, files]) => files.length > 1)
      .map(([id, files]) => ({ id, files }));

    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();
    this.softAdjacencyList = new Map();
    this.softReverseAdjacencyList = new Map();

    this.buildGraph();
  }

  private buildGraph(): void {
    this.adrs.forEach((_, id) => {
      this.adjacencyList.set(id, []);
      this.reverseAdjacencyList.set(id, []);
      this.softAdjacencyList.set(id, []);
      this.softReverseAdjacencyList.set(id, []);
    });

    this.adrs.forEach((adr) => {
      const hardSet = new Set(adr.dependencies);
      adr.dependencies.forEach((depId) => {
        if (this.adjacencyList.has(depId)) {
          this.adjacencyList.get(depId)!.push(adr.id);
        }
        if (this.reverseAdjacencyList.has(adr.id)) {
          this.reverseAdjacencyList.get(adr.id)!.push(depId);
        }
      });

      (adr.softDependencies || []).forEach((softId) => {
        if (hardSet.has(softId)) return;
        if (this.softAdjacencyList.has(softId)) {
          this.softAdjacencyList.get(softId)!.push(adr.id);
        }
        if (this.softReverseAdjacencyList.has(adr.id)) {
          this.softReverseAdjacencyList.get(adr.id)!.push(softId);
        }
      });
    });
  }

  /**
   * Kahn's Algorithm for Topological Sort & Circular Dependency Detection
   */
  public validate(): DAGValidationResult {
    const inDegree = new Map<string, number>();
    const missingDependencies: { adrId: string; missingId: string }[] = [];

    // Verify all referenced dependencies actually exist
    this.adrs.forEach((adr) => {
      inDegree.set(adr.id, 0);
      adr.dependencies.forEach((depId) => {
        if (!this.adrs.has(depId)) {
          missingDependencies.push({ adrId: adr.id, missingId: depId });
        }
      });
    });

    // Compute in-degrees based on existing nodes
    this.adrs.forEach((adr) => {
      adr.dependencies.forEach((depId) => {
        if (this.adrs.has(depId)) {
          inDegree.set(adr.id, (inDegree.get(adr.id) || 0) + 1);
        }
      });
    });

    const queue: string[] = [];
    inDegree.forEach((deg, id) => {
      if (deg === 0) queue.push(id);
    });

    const topologicalOrder: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      topologicalOrder.push(current);

      const dependents = this.adjacencyList.get(current) || [];
      dependents.forEach((dep) => {
        inDegree.set(dep, inDegree.get(dep)! - 1);
        if (inDegree.get(dep) === 0) {
          queue.push(dep);
        }
      });
    }

    const hasCycle = topologicalOrder.length !== this.adrs.size;
    let cyclePath: string[] | undefined;

    if (hasCycle) {
      cyclePath = this.detectCyclePath();
    }

    // Collect missing soft references (informational only)
    const missingSoftReferences: { adrId: string; missingId: string }[] = [];
    this.adrs.forEach((adr) => {
      (adr.softDependencies || []).forEach((softId) => {
        if (!this.adrs.has(softId)) {
          missingSoftReferences.push({ adrId: adr.id, missingId: softId });
        }
      });
    });

    // Detect soft mutual references (informational only, never errors)
    const mutualReferences: MutualReference[] = [];
    const seenPairs = new Set<string>();
    this.softReverseAdjacencyList.forEach((targets, idA) => {
      for (const idB of targets) {
        if (idA === idB) continue;
        const bTargets = this.softReverseAdjacencyList.get(idB) || [];
        if (bTargets.includes(idA)) {
          const pair: [string, string] = idA < idB ? [idA, idB] : [idB, idA];
          const key = `${pair[0]}::${pair[1]}`;
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            mutualReferences.push({ pair });
          }
        }
      }
    });

    return {
      isValid: !hasCycle && missingDependencies.length === 0 && this.duplicateIds.length === 0,
      hasCycle,
      cyclePath,
      missingDependencies,
      duplicateIds: this.duplicateIds,
      topologicalOrder,
      mutualReferences,
      missingSoftReferences,
    };
  }

  /**
   * DFS-based cycle path extractor for human-readable error reporting
   */
  private detectCyclePath(): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = this.adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of this.adrs.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) {
          const cycleNode = path[path.length - 1];
          const cycleStartIndex = path.indexOf(cycleNode);
          return path.slice(cycleStartIndex);
        }
      }
    }

    return [];
  }

  public getNodeIds(): string[] {
    return Array.from(this.adrs.keys());
  }

  public getNodeCount(): number {
    return this.adrs.size;
  }

  public getEdgeCount(): number {
    let edges = 0;
    this.adjacencyList.forEach((dependents) => {
      edges += dependents.length;
    });
    return edges;
  }

  public getIsolatedNodeCount(): number {
    let isolated = 0;
    this.adrs.forEach((_, id) => {
      const deps = this.reverseAdjacencyList.get(id) || [];
      const dependents = this.adjacencyList.get(id) || [];
      if (deps.length === 0 && dependents.length === 0) {
        isolated++;
      }
    });
    return isolated;
  }

  private getDependentsList(id: string, includeSoft = false): string[] {
    const hard = this.adjacencyList.get(id) || [];
    if (!includeSoft) return hard;
    const soft = this.softAdjacencyList.get(id) || [];
    return Array.from(new Set([...hard, ...soft]));
  }

  /**
   * Returns direct dependents (nodes that depend ON this node)
   */
  public getDirectDependents(id: string, options?: DAGQueryOptions): string[] {
    return [...this.getDependentsList(id, options?.includeSoft)];
  }

  /**
   * Returns nodes that soft-reference this node (excluding hard dependents)
   */
  public getSoftDependents(id: string): string[] {
    const hardSet = new Set(this.adjacencyList.get(id) || []);
    return (this.softAdjacencyList.get(id) || []).filter((refId) => !hardSet.has(refId));
  }

  /**
   * Returns direct dependencies (nodes that this node depends on)
   */
  public getDirectDependencies(id: string, options?: DAGQueryOptions): string[] {
    const hard = this.reverseAdjacencyList.get(id) || [];
    if (!options?.includeSoft) return [...hard];
    const soft = this.softReverseAdjacencyList.get(id) || [];
    return Array.from(new Set([...hard, ...soft]));
  }

  /**
   * Returns all root decisions (nodes with no dependencies on existing graph nodes)
   */
  public getRoots(): string[] {
    const roots: string[] = [];
    this.adrs.forEach((adr, id) => {
      const activeDeps = adr.dependencies.filter((depId) => this.adrs.has(depId));
      if (activeDeps.length === 0) {
        roots.push(id);
      }
    });
    return roots;
  }

  /**
   * Computes transitive blast radius for any ADR node
   */
  public getBlastRadius(rootId: string, options?: DAGQueryOptions): string[] {
    const impacted = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.getDependentsList(current, options?.includeSoft);
      dependents.forEach((childId) => {
        if (childId !== rootId && !impacted.has(childId)) {
          impacted.add(childId);
          queue.push(childId);
        }
      });
    }

    return Array.from(impacted);
  }

  /**
   * Computes per-node level (longest path distance from rootId) for each reachable dependent.
   * Terminates safely even if graph contains cycles.
   */
  public getCascadeLevels(rootId: string, options?: DAGQueryOptions): Record<string, number> {
    const levels: Record<string, number> = {};
    if (!this.adrs.has(rootId)) return levels;

    const currentPath = new Set<string>([rootId]);

    const dfs = (currentId: string, currentLevel: number) => {
      const dependents = this.getDependentsList(currentId, options?.includeSoft);
      for (const childId of dependents) {
        if (currentPath.has(childId)) {
          // Cycle detected along current path - safely skip to avoid infinite recursion
          continue;
        }
        const nextLevel = currentLevel + 1;
        if (!levels[childId] || nextLevel > levels[childId]) {
          levels[childId] = nextLevel;
        }
        currentPath.add(childId);
        dfs(childId, nextLevel);
        currentPath.delete(childId);
      }
    };

    dfs(rootId, 0);
    return levels;
  }

  /**
   * Computes the maximum depth of the blast radius (longest path from rootId through its dependents).
   * Returns 0 if node has no dependents.
   */
  public getDepth(rootId: string, options?: DAGQueryOptions): number {
    const levels = this.getCascadeLevels(rootId, options);
    const values = Object.values(levels);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }

  /**
   * Groups any list of node IDs by their ADR tags.
   * ADRs with no tags are grouped under 'untagged'.
   */
  public groupNodesBySystem(nodeIds: string[]): Record<string, string[]> {
    const systems: Record<string, string[]> = {};
    nodeIds.forEach((id) => {
      const adr = this.adrs.get(id);
      const tags = adr?.tags && adr.tags.length > 0 ? adr.tags : ['untagged'];
      tags.forEach((tag) => {
        if (!systems[tag]) systems[tag] = [];
        if (!systems[tag].includes(id)) {
          systems[tag].push(id);
        }
      });
    });
    return systems;
  }

  /**
   * Groups the blast cascade of a target ADR by system tags.
   * Returns an empty record if the cascade is empty.
   */
  public getAffectedSystems(rootId: string, options?: DAGQueryOptions): Record<string, string[]> {
    const cascade = this.getBlastRadius(rootId, options);
    if (cascade.length === 0) return {};
    return this.groupNodesBySystem(cascade);
  }
}

// (ParsedADR imported at top if needed or directly)

export function mapParsedToNirnay(parsed: ParsedADR): NirnayADR {
  const softDependencies = (parsed.edges || [])
    .filter((e) => e.kind === 'soft')
    .map((e) => e.targetId);

  return {
    id: parsed.frontmatter.id,
    title: parsed.frontmatter.title,
    category: 'Infrastructure', // fallback
    status: parsed.frontmatter.status as any,
    timestamp: parsed.frontmatter.date,
    context: parsed.context,
    decision: parsed.decision,
    consequences: {
      pros: parsed.consequences.positive,
      cons: parsed.consequences.negative,
    },
    dependencies: parsed.frontmatter.depends_on || [],
    softDependencies,
    edgeRefs: parsed.edges,
    supersedes: parsed.frontmatter.supersedes?.[0],
    tags: parsed.frontmatter.tags || [],
    filePath: parsed.filePath,
  };
}

export function validateAndComputeDAG(parsedADRs: ParsedADR[]): { validationResult: DAGValidationResult, engine: DAGEngine, mappedAdrs: NirnayADR[] } {
  const mappedAdrs = parsedADRs.map(mapParsedToNirnay);
  const engine = new DAGEngine(mappedAdrs);
  const validationResult = engine.validate();
  return { validationResult, engine, mappedAdrs };
}
