import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import type { NirnayADR } from '../core/types';
import { buildGraph, getBlastRadius } from '../core/dagEngine';
import { DecisionNode } from './DecisionNode';
import type { DecisionNodeType } from './DecisionNode';
import { GlowEdge } from './GlowEdge';

interface NirnayCanvasProps {
  data: NirnayADR[];
  searchQuery: string;
  isSimulating: boolean;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
  onImpactComputed: (count: number) => void;
}

const nodeTypes = {
  decision: DecisionNode,
};

const edgeTypes = {
  glow: GlowEdge,
};

const getLayoutedElements = <T extends Node>(nodes: T[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 320;
  const nodeHeight = 180;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export function NirnayCanvas({
  data,
  searchQuery,
  isSimulating,
  onNodeSelect,
  selectedNodeId,
  onImpactComputed
}: NirnayCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<DecisionNodeType>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const graph = useMemo(() => buildGraph(data), [data]);

  useEffect(() => {
    let blastRadiusNodes: string[] = [];
    if (isSimulating && selectedNodeId) {
      blastRadiusNodes = getBlastRadius(selectedNodeId, graph);
      onImpactComputed(blastRadiusNodes.length);
    } else {
      onImpactComputed(0);
    }

    const initialNodes: DecisionNodeType[] = data.map((n) => {
      const isMatch = searchQuery ? n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.id.toLowerCase().includes(searchQuery.toLowerCase()) : true;
      const inBlastRadius = blastRadiusNodes.includes(n.id);
      
      const isDimmed = Boolean((!isMatch) || (isSimulating && selectedNodeId && n.id !== selectedNodeId && !inBlastRadius));
      const isImpacted = isSimulating && inBlastRadius;

      return {
        id: n.id,
        type: 'decision',
        data: {
          ...n,
          isDimmed,
          isImpacted
        },
        position: { x: 0, y: 0 },
      };
    });

    const initialEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'glow',
      animated: e.animated || (isSimulating && blastRadiusNodes.includes(e.target)),
      style: { stroke: e.type === 'supersedes' ? '#6366f1' : '#374151', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: e.type === 'supersedes' ? '#6366f1' : '#374151',
      },
    }));

    const layouted = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
  }, [data, graph, searchQuery, isSimulating, selectedNodeId, setNodes, setEdges, onImpactComputed]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    onNodeSelect(node.id);
  }, [onNodeSelect]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        className="touch-none"
        minZoom={0.1}
      >
        <Background gap={20} color="rgba(255, 255, 255, 0.05)" />
        <Controls className="!bg-panel !border-white/[0.08] !text-white fill-white shadow-2xl rounded-xl" />
      </ReactFlow>
    </div>
  );
}
