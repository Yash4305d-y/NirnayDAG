import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Node,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SAMPLE_ADRS } from '../mocks/sampleAdrs.js';
import type { NirnayADR } from '../core/types.js';
import { SimulationEngine } from '../core/simulationEngine.js';
import { getLayoutedGraph } from '../core/layoutEngine.js';
import { StitchNodeCard } from './fx/StitchNodeCard.js';
import { EnergyFlowEdge } from './fx/EnergyFlowEdge.js';
import { GlassHUD } from './fx/GlassHUD.js';
import { SimulatorDock } from './SimulatorDock.js';
import { DecisionDrawer } from './DecisionDrawer.js';
import { BackgroundMatrix } from './fx/BackgroundMatrix.js';
import { useSimulationStore } from '../store/useSimulationStore.js';
import { DAGEngine } from '../core/dagEngine.js';

// @ts-ignore
const nodeTypes = { decisionNode: StitchNodeCard };
const edgeTypes = { glowEdge: EnergyFlowEdge };

const CanvasInner = ({ customAdrs }: { customAdrs?: NirnayADR[] | null }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [selectedAdr, setSelectedAdr] = useState<NirnayADR | null>(null);
  const [impactedIds, setImpactedIds] = useState<string[]>([]);
  
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');

  const { fitView } = useReactFlow();

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
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedGraph(activeData.adrs, layoutDirection);

    const enrichedNodes = layoutedNodes.map((n: Node) => {
      const isSelected = selectedAdr?.id === n.id;
      const isImpacted = impactedIds.includes(n.id) || activeData.impacted.includes(n.id);
      const isDimmed = (selectedAdr !== null) && !isSelected && !isImpacted;
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
    
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 50);
  }, [activeData, selectedAdr, impactedIds, setNodes, setEdges, isSimulationMode, fitView, layoutDirection]);

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
    <>
      <GlassHUD totalNodes={activeData.adrs.length} layoutDirection={layoutDirection} onToggleLayout={() => setLayoutDirection(d => d === 'TB' ? 'LR' : 'TB')} />
      <SimulatorDock />
      <DecisionDrawer adr={selectedAdr} isOpen={selectedAdr !== null} onClose={onPaneClick} impactedIds={impactedIds} />

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
        className="z-10"
        minZoom={0.2}
        maxZoom={1.5}
      />
    </>
  );
};

export const NirnayCanvas = ({ customAdrs }: { customAdrs?: NirnayADR[] | null }) => {
  return (
    <div className={`w-full h-screen bg-[var(--bg-deep-obsidian)] relative overflow-hidden transition-all duration-700`}>
      <BackgroundMatrix />
      <ReactFlowProvider>
        <CanvasInner customAdrs={customAdrs} />
      </ReactFlowProvider>
    </div>
  );
};
