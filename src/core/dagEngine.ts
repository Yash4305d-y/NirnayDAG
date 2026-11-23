import type { NirnayADR, ParsedADR } from './types.js';

export interface DAGValidationResult {
  isValid: boolean;
  hasCycle: boolean;
  cyclePath?: string[];
  missingDependencies: { adrId: string; missingId: string }[];
  topologicalOrder: string[];
}

export class DAGEngine {
  private adrs: Map<string, NirnayADR>;
  private adjacencyList: Map<string, string[]>; // dependency -> dependents (forward)
  private reverseAdjacencyList: Map<string, string[]>; // dependent -> dependencies (backward)

  constructor(adrs: NirnayADR[]) {
    this.adrs = new Map(adrs.map((a) => [a.id, a]));
    this.adjacencyList = new Map();
    this.reverseAdjacencyList = new Map();

    this.buildGraph();
  }

  private buildGraph(): void {
    this.adrs.forEach((_, id) => {
      this.adjacencyList.set(id, []);
      this.reverseAdjacencyList.set(id, []);
    });

    this.adrs.forEach((adr) => {
      adr.dependencies.forEach((depId) => {
        if (this.adjacencyList.has(depId)) {
          this.adjacencyList.get(depId)!.push(adr.id);
        }
        if (this.reverseAdjacencyList.has(adr.id)) {
          this.reverseAdjacencyList.get(adr.id)!.push(depId);
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

    return {
      isValid: !hasCycle && missingDependencies.length === 0,
      hasCycle,
      cyclePath,
      missingDependencies,
      topologicalOrder,
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
        if (dfs(node)) return path;
      }
    }

    return [];
  }

  /**
   * Returns direct dependents (nodes that depend ON this node)
   */
  public getDirectDependents(id: string): string[] {
    return [...(this.adjacencyList.get(id) || [])];
  }

  /**
   * Returns direct dependencies (nodes that this node depends on)
   */
  public getDirectDependencies(id: string): string[] {
    return [...(this.reverseAdjacencyList.get(id) || [])];
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
  public getBlastRadius(rootId: string): string[] {
    const impacted = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = this.adjacencyList.get(current) || [];
      dependents.forEach((childId) => {
        if (!impacted.has(childId)) {
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
  public getCascadeLevels(rootId: string): Record<string, number> {
    const levels: Record<string, number> = {};
    if (!this.adrs.has(rootId)) return levels;

    const currentPath = new Set<string>([rootId]);

    const dfs = (currentId: string, currentLevel: number) => {
      const dependents = this.adjacencyList.get(currentId) || [];
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
  public getDepth(rootId: string): number {
    const levels = this.getCascadeLevels(rootId);
    const values = Object.values(levels);
    if (values.length === 0) return 0;
    return Math.max(...values);
  }
}

// (ParsedADR imported at top if needed or directly)

export function mapParsedToNirnay(parsed: ParsedADR): NirnayADR {
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
    supersedes: parsed.frontmatter.supersedes?.[0],
  };
}

export function validateAndComputeDAG(parsedADRs: ParsedADR[]): { validationResult: DAGValidationResult, engine: DAGEngine, mappedAdrs: NirnayADR[] } {
  const mappedAdrs = parsedADRs.map(mapParsedToNirnay);
  const engine = new DAGEngine(mappedAdrs);
  const validationResult = engine.validate();
  return { validationResult, engine, mappedAdrs };
}
