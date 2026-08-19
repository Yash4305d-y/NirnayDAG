import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { SAMPLE_ADRS } from '../mocks/sampleAdrs';
import type { NirnayADR } from '../core/types';
import { DAGEngine } from '../core/dagEngine';
import { getLayoutedGraph } from '../core/layoutEngine';
import { DecisionNode } from './DecisionNode';
import { GlowEdge } from './GlowEdge';
import { ShieldAlert, Zap, Layers, GitBranch } from 'lucide-react';

const nodeTypes = { decisionNode: DecisionNode };
const edgeTypes = { glowEdge: GlowEdge };

export const NirnayCanvas = () => {
  const [selectedAdr, setSelectedAdr] = useState<NirnayADR | null>(null);
  const [impactedIds, setImpactedIds] = useState<string[]>([]);

  const engine = useMemo(() => new DAGEngine(SAMPLE_ADRS), []);

  const calculateBlastRadius = useCallback((rootId: string) => {
    return engine.getBlastRadius(rootId);
  }, [engine]);

  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const { nodes, edges } = getLayoutedGraph(SAMPLE_ADRS, 'TB');
    
    const finalNodes = nodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        isDimmed: selectedAdr ? selectedAdr.id !== n.id && !impactedIds.includes(n.id) : false,
      }
    }));

    const finalEdges = edges.map(e => ({
      ...e,
      selected: selectedAdr?.id === e.source || selectedAdr?.id === e.target,
    }));

    return { nodes: finalNodes, edges: finalEdges };
  }, [selectedAdr, impactedIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Sync state manually because useNodesState initial values aren't reactive after mount
  useMemo(() => {
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

  const handleNodeClick = (_: any, node: Node) => {
    const targetAdr = SAMPLE_ADRS.find((a) => a.id === node.id) || null;
    setSelectedAdr(targetAdr);
    if (targetAdr) {
      setImpactedIds(calculateBlastRadius(targetAdr.id));
    } else {
      setImpactedIds([]);
    }
  };

  const handlePaneClick = () => {
    setSelectedAdr(null);
    setImpactedIds([]);
  };

  return (
    <div className="relative w-full h-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans">
      {/* Top Floating Glass HUD */}
      <header className="absolute top-5 left-6 z-20 flex items-center gap-4 px-5 py-3 rounded-2xl bg-[#0d111a]/80 border border-white/[0.08] backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              NirnayDAG
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-400/10 border border-cyan-400/20 text-cyan-300">
                v0.1
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">Architecture Decision Topology</p>
          </div>
        </div>
      </header>

      {/* Interactive ReactFlow Graph Canvas */}
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

      {/* Right-Side Decision Inspector Drawer */}
      {selectedAdr && (
        <aside className="absolute top-5 right-6 bottom-5 w-96 z-20 flex flex-col rounded-2xl bg-[#0d111a]/90 border border-white/[0.08] backdrop-blur-2xl p-6 shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
              {selectedAdr.id}
            </span>
            <button
              onClick={() => setSelectedAdr(null)}
              className="text-slate-400 hover:text-white text-xs font-mono uppercase tracking-wider"
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white leading-snug">{selectedAdr.title}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">{selectedAdr.timestamp} • {selectedAdr.category}</p>
            </div>

            {/* Blast Radius Warning Card */}
            {impactedIds.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold text-amber-300">Blast Radius Alert: </span>
                  <span className="text-amber-200/80">
                    Modifying this decision directly impacts {impactedIds.length} downstream node(s): {impactedIds.join(', ')}.
                  </span>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Context</h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                {selectedAdr.context}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-1">Resolution</h4>
              <p className="text-xs text-slate-200 leading-relaxed bg-cyan-500/[0.03] p-3 rounded-lg border border-cyan-500/10">
                {selectedAdr.decision}
              </p>
            </div>

            {/* Trade-offs & Consequences Matrix */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">Trade-Offs</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mb-1">
                    <Zap className="w-3 h-3" /> Positive Impacts
                  </span>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                    {selectedAdr.consequences.pros.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1 mb-1">
                    <Layers className="w-3 h-3" /> Technical Debt / Trade-Offs
                  </span>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                    {selectedAdr.consequences.cons.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
