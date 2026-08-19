import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore.js';
import { ShieldAlert, RefreshCcw, FileText, Zap } from 'lucide-react';

export const SimulatorDock: React.FC = () => {
  const { isSimulationMode, toggleSimulationMode, fragilityScore, resetSimulation, simulatedOverrides } = useSimulationStore();

  const handleExport = () => {
    const data = JSON.stringify({ simulatedOverrides, fragilityScore }, null, 2);
    const blob = new Blob([data], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NirnayDAG-Simulation-RFC.md';
    a.click();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[var(--bg-surface-glass)] backdrop-blur-2xl border border-[var(--border-subtle)] px-6 py-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] pointer-events-auto">
      <div className="flex flex-col border-r border-[var(--border-subtle)] pr-6 mr-2">
        <span className="text-[9px] text-slate-400 font-bold tracking-[0.2em] uppercase mb-1 flex items-center gap-1.5">
          <Zap size={10} className={isSimulationMode ? "text-[var(--glow-vichar)]" : "text-slate-500"} />
          Sim Engine
        </span>
        <button
          onClick={toggleSimulationMode}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-500 ${isSimulationMode ? 'bg-[var(--glow-vichar)]' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-500 ${isSimulationMode ? 'translate-x-8 shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'translate-x-1'}`} />
        </button>
      </div>

      {isSimulationMode && (
        <>
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-1">Fragility</span>
            <div className="flex items-center gap-2">
              <ShieldAlert className={fragilityScore > 50 ? 'text-[var(--glow-tyakta)]' : 'text-[var(--glow-vichar)]'} size={18} />
              <span className={`text-2xl font-black ${fragilityScore > 50 ? 'text-[var(--glow-tyakta)] drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'text-[var(--glow-vichar)] drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]'}`}>
                {fragilityScore}
              </span>
              <span className="text-xs text-slate-500 font-bold">/ 100</span>
            </div>
          </div>

          <div className="h-10 w-px bg-[var(--border-subtle)] mx-2" />

          <div className="flex gap-2">
            <button
              onClick={resetSimulation}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
            >
              <RefreshCcw size={14} /> Reset
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors border border-indigo-500/30 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            >
              <FileText size={14} /> Export RFC
            </button>
          </div>
        </>
      )}
    </div>
  );
};
