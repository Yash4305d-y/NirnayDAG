import { NirnayNode, DAGGraph } from './types';

export function buildGraph(nodes: NirnayNode[]): DAGGraph {
  const graph: DAGGraph = {
    nodes: {},
    edges: [],
    adjacencyList: {},
    reverseAdjacencyList: {}
  };

  // Initialize nodes and empty adjacency lists
  nodes.forEach(node => {
    graph.nodes[node.id] = node;
    graph.adjacencyList[node.id] = [];
    graph.reverseAdjacencyList[node.id] = [];
  });

  // Populate edges and adjacency lists
  nodes.forEach(node => {
    node.dependencies.forEach(depId => {
      if (graph.nodes[depId]) {
        graph.edges.push({
          id: `${depId}->${node.id}`,
          source: depId,
          target: node.id,
          type: 'dependency'
        });
        graph.adjacencyList[depId].push(node.id);
        graph.reverseAdjacencyList[node.id].push(depId);
      }
    });

    if (node.supersedes && graph.nodes[node.supersedes]) {
      graph.edges.push({
        id: `${node.supersedes}=>${node.id}`,
        source: node.supersedes,
        target: node.id,
        type: 'supersedes',
        animated: true,
        label: 'supersedes'
      });
      // For DAG analysis, treat supersedes as a directed edge from the old to the new
      graph.adjacencyList[node.supersedes].push(node.id);
      graph.reverseAdjacencyList[node.id].push(node.supersedes);
    }
  });

  return graph;
}

export function detectCycle(graph: DAGGraph): { hasCycle: boolean; cyclePath?: string[] } {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const path: string[] = [];

  for (const nodeId in graph.nodes) {
    if (detectCycleUtil(nodeId, graph, visited, recStack, path)) {
      return { hasCycle: true, cyclePath: [...path, nodeId] };
    }
  }

  return { hasCycle: false };
}

function detectCycleUtil(
  nodeId: string,
  graph: DAGGraph,
  visited: Record<string, boolean>,
  recStack: Record<string, boolean>,
  path: string[]
): boolean {
  if (recStack[nodeId]) {
    return true; // Cycle detected
  }
  if (visited[nodeId]) {
    return false;
  }

  visited[nodeId] = true;
  recStack[nodeId] = true;
  path.push(nodeId);

  for (const neighbor of graph.adjacencyList[nodeId] || []) {
    if (detectCycleUtil(neighbor, graph, visited, recStack, path)) {
      return true;
    }
  }

  path.pop();
  recStack[nodeId] = false;
  return false;
}

export function getTopologicalOrder(graph: DAGGraph): string[] {
  if (detectCycle(graph).hasCycle) {
    throw new Error("Graph contains a cycle, cannot perform topological sort");
  }

  const inDegree: Record<string, number> = {};
  for (const nodeId in graph.nodes) {
    inDegree[nodeId] = 0;
  }

  for (const nodeId in graph.adjacencyList) {
    for (const neighbor of graph.adjacencyList[nodeId]) {
      inDegree[neighbor]++;
    }
  }

  const queue: string[] = [];
  for (const nodeId in inDegree) {
    if (inDegree[nodeId] === 0) {
      queue.push(nodeId);
    }
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of graph.adjacencyList[current] || []) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  return order;
}

export function getBlastRadius(nodeId: string, graph: DAGGraph): string[] {
  const blastRadius = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of graph.adjacencyList[current] || []) {
      if (!blastRadius.has(neighbor)) {
        blastRadius.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return Array.from(blastRadius);
}
