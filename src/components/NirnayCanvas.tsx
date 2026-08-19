import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SAMPLE_ADRS } from '../mocks/sampleAdrs.js';
import type { NirnayADR } from '../core/types.js';
import { SimulationEngine } from '../core/simulationEngine.js';
import { getLayoutedGraph } from '../core/layoutEngine.js';
import { DecisionNode } from './DecisionNode.js';
import { GlowEdge } from './GlowEdge.js';
import { Layers, ShieldAlert } from 'lucide-react';
import { useSimulationStore } from '../store/useSimulationStore.js';
import { SimulatorHUD } from './SimulatorHUD.js';
import { DAGEngine } from '../core/dagEngine.js';

// @ts-ignore
const nodeTypes = { decisionNode: StitchNodeCard };
const edgeTypes = { glowEdge: GlowEdge };

export const NirnayCanvas = ({ customAdrs }: { customAdrs?: NirnayADR[] | null }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedAdr, setSelectedAdr] = useState<NirnayADR | null>(null);
  const [impactedIds, setImpactedIds] = useState<string[]>([]);

  const {
    isSimulationMode,
    simulatedOverrides,
    virtualNodes,
    virtualEdges,
    setFragilityScore,
  } = useSimulationStore();

  const baseAdrs = customAdrs || SAMPLE_ADRS;

  const activeData = useMemo(() => {
    if (isSimulationMode) {
      const result = SimulationEngine.compute(
        baseAdrs,
        simulatedOverrides,
        virtualNodes,
        virtualEdges
      );
      setFragilityScore(result.fragilityScore);
      return { adrs: result.activeGraph, orphaned: result.orphanedNodes, impacted: result.impactedNodes };
    }
    return { adrs: baseAdrs, orphaned: [], impacted: [] };
  }, [isSimulationMode, simulatedOverrides, virtualNodes, virtualEdges, setFragilityScore, baseAdrs]);

  const calculateBlastRadius = useCallback((rootId: string) => {
    const engine = new DAGEngine(activeData.adrs);
    return engine.getBlastRadius(rootId);
  }, [activeData.adrs]);

  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedGraph(activeData.adrs);

    const enrichedNodes = layoutedNodes.map((n: Node) => {
      const isSelected = selectedAdr?.id === n.id;
      const isImpacted = impactedIds.includes(n.id) || activeData.impacted.includes(n.id);
      const isDimmed = (selectedAdr || impactedIds.length > 0) && !isSelected && !isImpacted;
      const isOrphaned = activeData.orphaned.includes(n.id);

      return {
        ...n,
        type: 'decisionNode',
        data: {
          ...n.data,
          isSelected,
          isHighlighted: isImpacted,
          isDimmed,
          isOrphaned,
          isSimulationMode
        },
      };
    });

    const enrichedEdges = layoutedEdges.map((e: any) => ({
      ...e,
      type: 'glowEdge',
      animated: impactedIds.includes(e.source) || activeData.impacted.includes(e.source),
      selected: selectedAdr?.id === e.target || selectedAdr?.id === e.source,
      style: {
        stroke: (impactedIds.includes(e.source) || activeData.impacted.includes(e.source)) ? 'var(--glow-tyakta)' : undefined,
      }
    }));

    setNodes(enrichedNodes);
    setEdges(enrichedEdges);
  }, [activeData, selectedAdr, impactedIds, setNodes, setEdges, isSimulationMode]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const adr = activeData.adrs.find((a) => a.id === node.id);
    if (adr) {
      setSelectedAdr(adr);
      if (!isSimulationMode) {
        setImpactedIds(calculateBlastRadius(adr.id));
      } else {
        setImpactedIds([]);
      }
    }
  }, [activeData.adrs, calculateBlastRadius, isSimulationMode]);

  const onPaneClick = useCallback(() => {
    setSelectedAdr(null);
    setImpactedIds([]);
  }, []);

  return (
    <div className={`w-full h-screen bg-[var(--bg-deep-obsidian)] relative transition-colors duration-500 ${isSimulationMode ? 'shadow-[inset_0_0_100px_rgba(245,158,11,0.15)]' : ''}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-[var(--bg-deep-obsidian)]/80 to-[var(--bg-deep-obsidian)] pointer-events-none z-0" />
      
      <div className="absolute top-6 left-6 z-10 flex items-center gap-4 bg-[var(--bg-surface-glass)] backdrop-blur-xl border border-[var(--border-subtle)] px-6 py-3 rounded-2xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">
              NirnayDAG
            </h1>
            <p className="text-xs text-slate-500 font-medium tracking-wide">
              {isSimulationMode ? 'SIMULATION SANDBOX' : 'ARCHITECTURE GRAPH'}
            </p>
          </div>
        </div>
        <div className="h-8 w-px bg-[var(--border-subtle)] mx-2" />
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Total Nodes</span>
            <span className="text-sm font-semibold text-slate-200">{activeData.adrs.length} Decisions</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Health</span>
            <span className="text-sm font-semibold text-[var(--glow-siddha)] flex items-center gap-1">
              <ShieldAlert size={14} /> Zero Cycles
            </span>
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="z-0"
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background 
          color={isSimulationMode ? "var(--glow-vichar)" : "#475569"} 
          variant={BackgroundVariant.Dots} 
          gap={24} 
          size={1.5} 
          style={{ opacity: isSimulationMode ? 0.3 : 0.5 }} 
        />
        <Controls className="!bg-[#12141c]/80 !border-white/10 !backdrop-blur-md !fill-slate-300" />
      </ReactFlow>

      <SimulatorHUD />
    </div>
  );
};
