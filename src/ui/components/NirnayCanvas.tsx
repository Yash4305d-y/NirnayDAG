import { useState, useCallback, useMemo } from 'react';
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

import { parseBatchADRs } from '../../core/adrParser.js';
import { validateAndComputeDAG, type DAGValidationResult } from '../../core/dagEngine.js';
import { getLayoutedGraph } from '../../core/layoutEngine.js';
import type { ParsedADR, BlastRadiusMap, NirnayADR } from '../../core/types.js';

import { DecisionNode } from './DecisionNode.js';
import { GlowEdge } from './GlowEdge.js';
import { DecisionDrawer } from './DecisionDrawer.js';
import { SourceModal } from './SourceModal.js';
import { GraphToolbar, type FilterState } from './GraphToolbar.js';
import { ExportMenu } from './ExportMenu.js';
import { Toast, type ToastConfig } from './Toast.js';
import { AlertCircle, FolderGit2, Database, X } from 'lucide-react';
import { exportCanvasToPNG, exportCanvasToSVG, exportGraphAsJSON } from '../../utils/exportEngine.js';
import { SimulatorDock } from './SimulatorDock.js';

const nodeTypes = { decisionNode: DecisionNode };
const edgeTypes = { glowEdge: GlowEdge };

const CanvasContent = () => {
  // State Management as specified
  const [adrs, setAdrs] = useState<ParsedADR[]>([]);
  const [selectedADR, setSelectedADR] = useState<ParsedADR | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<DAGValidationResult | null>(null);
  const [blastRadiusMap, setBlastRadiusMap] = useState<BlastRadiusMap>({});
  
  // React Flow internal states
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // Additional states for HUD
  const [toastMessage, setToastMessage] = useState<ToastConfig | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: [],
    category: 'All'
  });
  
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [simulatedDeprecatedIds, setSimulatedDeprecatedIds] = useState<string[]>([]);

  // Compute simulated blast radius corridor
  const simulatedBlastCorridor = useMemo(() => {
    const corridor = new Set<string>();
    simulatedDeprecatedIds.forEach(id => {
      corridor.add(id);
      if (blastRadiusMap[id]) {
        blastRadiusMap[id].totalCascade.forEach(depId => corridor.add(depId));
      }
    });
    return corridor;
  }, [simulatedDeprecatedIds, blastRadiusMap]);

  // Handle file ingestion pipeline
  const handleFilesLoaded = useCallback((files: Array<{ name: string; content: string }>) => {
    setIsSourceModalOpen(false);
    
    // 1. Parse raw files
    const parsedADRs = parseBatchADRs(files);
    
    // 2. Validate and compute DAG
    const { validationResult: vr, engine, mappedAdrs: mAdrs } = validateAndComputeDAG(parsedADRs);
    setValidationResult(vr);
    setAdrs(parsedADRs);
    
    // 3. Apply Dagre auto-layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedGraph(mAdrs, 'TB');
    
    // Compute blast radius map for all nodes
    const brm: BlastRadiusMap = {};
    parsedADRs.forEach(adr => {
      const cascade = engine.getBlastRadius(adr.frontmatter.id);
      brm[adr.frontmatter.id] = {
        directDependents: adr.frontmatter.depends_on || [],
        totalCascade: cascade,
        depth: cascade.length > 0 ? 1 : 0
      };
    });
    setBlastRadiusMap(brm);

    // 4. Update React Flow
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
    
    setSelectedADR(null);
    
    setToastMessage({
      type: 'success',
      title: `✅ Loaded ${parsedADRs.length} ADRs successfully`,
      subtitle: vr.hasCycle ? '⚠️ Cycles detected in DAG.' : 'Graph computed perfectly.'
    });

    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
  }, [setNodes, setEdges, fitView]);

  // Interactive Node Selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const found = adrs.find(a => a.frontmatter.id === node.id) || (node.data as any as ParsedADR);
    if (found) setSelectedADR(found);
  }, [adrs]);

  const onPaneClick = useCallback(() => {
    setSelectedADR(null);
  }, []);

  // Compute node visibility based on filters
  const filteredNodes = useMemo(() => {
    return nodes.map((node) => {
      const data = node.data as NirnayADR;
      const matchesSearch = filters.search === '' || 
        data.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        data.id.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = filters.status.length === 0 || filters.status.includes(data.status);
      const matchesCategory = filters.category === 'All' || data.category === filters.category;
      
      const isVisible = matchesSearch && matchesStatus && matchesCategory;
      
      const isTargeted = isSimulatorOpen && simulatedDeprecatedIds.includes(node.id);
      const isAffected = isSimulatorOpen && !isTargeted && simulatedBlastCorridor.has(node.id);
      const isUnaffected = isSimulatorOpen && !simulatedBlastCorridor.has(node.id);

      return {
        ...node,
        hidden: !isVisible,
        data: {
          ...node.data,
          status: isTargeted ? 'deprecated' : data.status, // apply simulated status
          isSelected: selectedADR?.frontmatter.id === node.id,
          // Add dimmed state if it's not selected and not in blast radius
          isDimmed: (!isSimulatorOpen && selectedADR && node.id !== selectedADR.frontmatter.id && !blastRadiusMap[selectedADR.frontmatter.id]?.totalCascade.includes(node.id)) || isUnaffected,
          isSimulationMode: isSimulatorOpen,
          isTargeted,
          isAffected
        }
      };
    });
  }, [nodes, filters, selectedADR, blastRadiusMap, isSimulatorOpen, simulatedDeprecatedIds, simulatedBlastCorridor]);

  return (
    <div className="w-full h-screen bg-[#06080e] font-sans relative overflow-hidden flex flex-col">
      {/* Background grid */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30" 
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      
      {/* Graph Toolbar Area */}
      <div className="absolute top-0 left-0 right-0 z-40 p-4 pointer-events-none flex justify-between items-start">
        <div className="pointer-events-auto">
          <GraphToolbar 
            filters={filters} 
            onFilterChange={setFilters} 
            onOpenSourceModal={() => setIsSourceModalOpen(true)}
            onToggleSimulator={() => setIsSimulatorOpen(!isSimulatorOpen)}
            isSimulatorOpen={isSimulatorOpen}
          />
        </div>
        <div className="pointer-events-auto">
          <ExportMenu 
            onExportPng={() => exportCanvasToPNG()}
            onExportSvg={() => exportCanvasToSVG()}
            onExportJson={() => exportGraphAsJSON(adrs, blastRadiusMap, validationResult?.topologicalOrder || [])}
          />
        </div>
      </div>

      {/* Cycle Detection HUD Banner */}
      {validationResult?.hasCycle && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-rose-950/40 border border-amber-500/50 backdrop-blur-md px-6 py-3 rounded-2xl flex items-center gap-4 shadow-[0_0_30px_rgba(244,63,94,0.2)] animate-pulse border-x-rose-500/40">
          <AlertCircle className="text-amber-500 animate-pulse shrink-0" size={18} />
          <div className="flex flex-col">
            <span className="text-rose-200 font-semibold text-sm tracking-wide">Circular Dependency Detected</span>
            {validationResult.cyclePath && (
              <span className="font-mono text-amber-300/80 text-[11px] mt-0.5 uppercase">
                {validationResult.cyclePath.join(' → ')}
              </span>
            )}
          </div>
          <button onClick={() => setValidationResult(prev => prev ? { ...prev, hasCycle: false } : null)} className="ml-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5">
            <X size={14} />
          </button>
        </div>
      )}

      {/* React Flow Canvas or Empty State */}
      {adrs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center z-10 animate-in fade-in zoom-in duration-500">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl animate-pulse" />
            <div className="w-16 h-16 rounded-2xl bg-[#0b0f19]/80 border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center justify-center relative z-10 backdrop-blur-md">
              <Database className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-cyan-500/10 rounded-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-500/5 rounded-full" />
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2 tracking-wide">No Architecture Decisions</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-sm text-center">
            Import your markdown ADRs to automatically generate and visualize your architecture decision graph.
          </p>
          <button
            onClick={() => setIsSourceModalOpen(true)}
            className="h-10 px-6 rounded-lg text-sm font-medium text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] active:scale-[0.98] transition-all flex items-center gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.3)]"
          >
            <FolderGit2 size={16} />
            Load Directory
          </button>
        </div>
      ) : (
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes as any}
          edgeTypes={edgeTypes}
          fitView
          minZoom={0.1}
          maxZoom={1.5}
          className="z-10"
        >
          {/* Internal XYFlow Background hidden since we use a custom base SVG grid */}
          <Background variant={BackgroundVariant.Dots} gap={24} size={0} color="transparent" />
          <Controls className="!bg-[#0b0f19]/80 backdrop-blur-md !border-white/[0.08] !fill-slate-400 shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-xl overflow-hidden [&_button]:!border-b-white/[0.08]" />
          <MiniMap 
            className="!bg-[#0d111a]/90 !border-white/10 rounded-xl overflow-hidden" 
            nodeColor={(node) => {
              const data = node.data as any;
              if (data.isTargeted) return '#f59e0b';
              if (data.isAffected) return '#f43f5e';
              if (data.status === 'accepted') return '#10b981';
              if (data.status === 'proposed') return '#f59e0b';
              if (data.status === 'deprecated') return '#f43f5e';
              return '#818cf8';
            }}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        </ReactFlow>
      )}

      {/* Slide-out Drawer */}
      <DecisionDrawer
        adr={selectedADR}
        onClose={() => setSelectedADR(null)}
        impactedIds={selectedADR ? blastRadiusMap[selectedADR.frontmatter.id]?.totalCascade || [] : []}
        onSelectNode={(id) => {
          const found = adrs.find(a => a.frontmatter.id === id);
          if (found) setSelectedADR(found);
        }}
      />

      {/* Source Modal */}
      <SourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onLoadSuccess={handleFilesLoaded}
      />

      {/* Simulator Dock */}
      <SimulatorDock 
        isOpen={isSimulatorOpen} 
        onToggle={() => setIsSimulatorOpen(!isSimulatorOpen)}
        adrs={adrs}
        simulatedDeprecatedIds={simulatedDeprecatedIds}
        blastRadiusMap={blastRadiusMap}
        onToggleSimulateDeprecate={(id) => {
          setSimulatedDeprecatedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        }}
        onResetSimulation={() => setSimulatedDeprecatedIds([])}
      />

      {/* Toast Notifications */}
      {toastMessage && (
        <Toast
          toast={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};

export const NirnayCanvas = () => (
  <ReactFlowProvider>
    <CanvasContent />
  </ReactFlowProvider>
);
