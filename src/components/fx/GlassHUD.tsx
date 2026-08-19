import React from 'react';
import { useSimulationStore } from '../../store/useSimulationStore.js';
import { ShieldAlert, Layers } from 'lucide-react';

interface GlassHUDProps {
  totalNodes: number;
}

export const GlassHUD: React.FC<GlassHUDProps> = ({ totalNodes }) => {
  const { isSimulationMode } = useSimulationStore();

  return (
    <div className="absolute top-6 left-6 z-50 flex items-center gap-4 bg-[var(--bg-surface-glass)] backdrop-blur-2xl border border-[var(--border-subtle)] px-6 py-3 rounded-2xl shadow-2xl pointer-events-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)]">
          <Layers className="text-white" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400" style={{ WebkitFontSmoothing: 'antialiased' }}>
            NirnayDAG
          </h1>
          <p className="text-[10px] text-[var(--glow-active)] font-bold tracking-widest uppercase">
            {isSimulationMode ? 'SIMULATION SANDBOX' : 'ARCHITECTURE GRAPH'}
          </p>
        </div>
      </div>
      <div className="h-8 w-px bg-[var(--border-subtle)] mx-2" />
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Total Nodes</span>
          <span className="text-sm font-semibold text-slate-200">{totalNodes} Decisions</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">Health</span>
          <span className="text-sm font-semibold text-[var(--glow-siddha)] flex items-center gap-1 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">
            <ShieldAlert size={14} /> Zero Cycles
          </span>
        </div>
      </div>
    </div>
  );
};
