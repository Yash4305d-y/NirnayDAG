import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SAMPLE_ADRS } from '../mocks/sampleAdrs.js';
import type { NirnayADR } from '../core/types.js';
import { DAGEngine } from '../core/dagEngine.js';
import { getLayoutedGraph } from '../core/layoutEngine.js';
import { DecisionNode } from './DecisionNode.js';
import { GlowEdge } from './GlowEdge.js';
import { DecisionDrawer } from './DecisionDrawer.js';
import { SimulatorDock } from './SimulatorDock.js';
import { SourceModal } from './SourceModal.js';
import { Toast, type ToastConfig } from './Toast.js';
import { GitBranch, Link, CheckCircle, AlertCircle } from 'lucide-react';
import { GraphToolbar, type FilterState } from './GraphToolbar.js';
import { ExportMenu } from './ExportMenu.js';
import { exportToPng, exportToSvg, exportToJson } from '../utils/exportGraph.js';

const nodeTypes = { decisionNode: DecisionNode };
const edgeTypes = { glowEdge: GlowEdge };

const CanvasContent = () => {
  const [adrs, setAdrs] = useState<NirnayADR[]>(SAMPLE_ADRS);
  const [selectedAdr, setSelectedAdr] = useState<NirnayADR | null>(null);
  const [impactedIds, setImpactedIds] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastConfig | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: [],
    category: 'All'
  });
  
  const { fitView } = useReactFlow();

  const dagEngine = useMemo(() => new DAGEngine(adrs), [adrs]);
  const validation = useMemo(() => dagEngine.validate(), [dagEngine]);

  const calculateBlast = useCallback(
    (id: string) => dagEngine.getBlastRadius(id),
    [dagEngine]
  );

  const filteredAdrs = useMemo(() => {
    return adrs.filter(adr => {
      if (filters.category !== 'All' && adr.category !== filters.category) return false;
      if (filters.status.length > 0 && !filters.status.includes(adr.status)) return false;
      if (filters.search) {
        const query = filters.search.toLowerCase();
        if (
          !adr.id.toLowerCase().includes(query) &&
          !adr.title.toLowerCase().includes(query) &&
          !adr.context.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [adrs, filters]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Synchronize dynamic updates & Dagre Layout
  useEffect(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedGraph(adrs, 'TB');

    // Generate set of filtered IDs for O(1) lookup
    const filteredIds = new Set(filteredAdrs.map(a => a.id));
    const isFiltering = filters.search || filters.status.length > 0 || filters.category !== 'All';

    const enrichedNodes = layoutedNodes.map((n: Node) => {
      const isMatch = filteredIds.has(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          isSelected: selectedAdr?.id === n.id,
          // Dim if we are selecting something and it's not impacted, OR if filtering is active and it doesn't match
          isDimmed: (selectedAdr ? (selectedAdr.id !== n.id && !impactedIds.includes(n.id)) : false) 
                    || (isFiltering && !isMatch)
        },
        // ignore pointer events if dimmed by filter
        style: isFiltering && !isMatch ? { pointerEvents: 'none' } : undefined,
      };
    });

    const enrichedEdges = layoutedEdges.map((e: Edge) => ({
      ...e,
      selected: selectedAdr?.id === e.source || selectedAdr?.id === e.target,
      animated: impactedIds.includes(e.source)
    }));

    setNodes(enrichedNodes);
    setEdges(enrichedEdges);
    
    // Auto-center after render
    setTimeout(() => {
      fitView({ padding: 0.25, duration: 400 });
    }, 50);
  }, [adrs, selectedAdr, impactedIds, filteredAdrs, filters, setNodes, setEdges, fitView]);

  const handleNodeClick = (_: any, node: Node) => {
    const target = adrs.find((a) => a.id === node.id) || null;
    setSelectedAdr(target);
    if (target) {
      setImpactedIds(calculateBlast(target.id));
    }
  };

  const handlePaneClick = () => {
    setSelectedAdr(null);
    setImpactedIds([]);
  };

  const handleImport = (newAdrs: NirnayADR[], count: number, errors: any[]) => {
    setAdrs(newAdrs);
    setSelectedAdr(null);
    setImpactedIds([]);
    setIsSourceModalOpen(false);
    
    if (errors.length > 0) {
      setToastMessage({
        type: 'warning',
        title: `⚠️ Imported ${newAdrs.length} ADRs successfully`,
        subtitle: `(${errors.length} files skipped due to format errors)`
      });
    } else {
      setToastMessage({
        type: 'success',
        title: `✅ Successfully imported ${newAdrs.length} ADRs`
      });
    }
    setTimeout(() => fitView({ padding: 0.25, duration: 400 }), 50);
  };

  const handleExportPng = async () => {
    const flowEl = document.querySelector('.react-flow') as HTMLElement;
    if (flowEl) {
      const rect = flowEl.getBoundingClientRect();
      await exportToPng(flowEl, rect.width, rect.height);
      setToastMessage({ type: 'success', title: 'Exported PNG successfully' });
    }
  };

  const handleExportSvg = async () => {
    const flowEl = document.querySelector('.react-flow') as HTMLElement;
    if (flowEl) {
      const rect = flowEl.getBoundingClientRect();
      await exportToSvg(flowEl, rect.width, rect.height);
      setToastMessage({ type: 'success', title: 'Exported SVG successfully' });
    }
  };

  const handleExportJson = () => {
    exportToJson(adrs);
    setToastMessage({ type: 'success', title: 'Exported JSON successfully' });
  };

  return (
    <div className="relative w-full h-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      <Toast toast={toastMessage} onClose={() => setToastMessage(null)} />
      <SourceModal 
        isOpen={isSourceModalOpen} 
        onClose={() => setIsSourceModalOpen(false)} 
        onImport={handleImport} 
        showToast={setToastMessage} 
      />

      {/* Top Floating HUD */}
      <header className="absolute top-5 left-6 z-20 flex items-center gap-6 px-5 py-3 rounded-2xl bg-[#0d111a]/85 border border-white/[0.08] backdrop-blur-xl shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              NirnayDAG
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Architecture Decision Topology</p>
          </div>
        </div>

        <div className="h-6 w-px bg-white/[0.08]" />

        <div className="flex items-center gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">Decisions</span>
            <span className="font-semibold text-slate-200">{adrs.length} Nodes</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px] block">Health</span>
            {validation.isValid ? (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Zero Cycles
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5" /> Loop Detected
              </span>
            )}
          </div>
        </div>
      </header>
      
      {/* Search & Filter Toolbar */}
      <GraphToolbar filters={filters} onFilterChange={setFilters} />

      {/* Top-Right Control Dock */}
      <div className="absolute top-5 right-6 z-20 flex items-center gap-3">
        <ExportMenu 
          onExportPng={handleExportPng}
          onExportSvg={handleExportSvg}
          onExportJson={handleExportJson}
        />
        <button
          onClick={() => setIsSourceModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d111a]/85 hover:bg-[#131926] border border-white/[0.08] hover:border-cyan-500/40 text-xs font-mono text-slate-200 transition-all duration-200 shadow-2xl pointer-events-auto"
        >
          <Link className="w-4 h-4 text-cyan-400" />
          <span>Connect Source</span>
        </button>
      </div>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        fitView
        className="h-full w-full"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="#1f293d" />
        <Controls className="!bg-[#0d111a]/90 !border-white/[0.08] !text-slate-300 [&>button]:!border-white/[0.06] rounded-xl overflow-hidden shadow-2xl" />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor="#1e293b"
          maskColor="rgba(7, 9, 14, 0.85)"
          className="!bg-[#0d111a]/90 !border !border-white/[0.08] !rounded-xl"
        />
      </ReactFlow>

      {/* Slide-out Decision Inspector */}
      <DecisionDrawer
        adr={selectedAdr}
        impactedIds={impactedIds}
        onClose={() => {
          setSelectedAdr(null);
          setImpactedIds([]);
        }}
        onSelectNode={(id) => {
          const target = adrs.find((a) => a.id === id);
          if (target) {
            setSelectedAdr(target);
            setImpactedIds(calculateBlast(target.id));
          }
        }}
      />

      {/* Fixed Bottom Simulator Dock */}
      <SimulatorDock
        isSimulating={isSimulating}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        impactCount={impactedIds.length}
      />
    </div>
  );
};

export const NirnayCanvas = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
);
