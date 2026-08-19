import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore.js';
import { ShieldAlert, RefreshCcw, FileText, Zap } from 'lucide-react';

export const SimulatorHUD: React.FC = () => {
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
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-[#12141c]/80 backdrop-blur-xl border border-white/10 px-6 py-4 rounded-2xl shadow-2xl">
      
      <div className="flex flex-col border-r border-white/10 pr-6 mr-2">
        <span className="text-xs text-slate-400 font-semibold tracking-widest uppercase mb-1 flex items-center gap-1">
          <Zap size={12} className={isSimulationMode ? "text-amber-400" : "text-slate-500"} />
          Simulation Engine
        </span>
        <button
          onClick={toggleSimulationMode}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${isSimulationMode ? 'bg-amber-500' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isSimulationMode ? 'translate-x-9' : 'translate-x-1'}`} />
        </button>
      </div>

      {isSimulationMode && (
        <>
          <div className="flex flex-col items-center min-w-[120px]">
            <span className="text-xs text-slate-400 font-semibold uppercase mb-1">Fragility Score</span>
            <div className="flex items-center gap-2">
              <ShieldAlert className={fragilityScore > 50 ? 'text-red-500' : 'text-amber-500'} size={20} />
              <span className={`text-2xl font-bold ${fragilityScore > 50 ? 'text-red-500' : 'text-amber-500'}`}>
                {fragilityScore}
              </span>
              <span className="text-sm text-slate-500">/ 100</span>
            </div>
          </div>

          <div className="h-10 w-px bg-white/10 mx-2" />

          <div className="flex gap-2">
            <button
              onClick={resetSimulation}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCcw size={16} /> Reset
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 text-sm font-medium rounded-lg transition-colors border border-indigo-500/30"
            >
              <FileText size={16} /> Export RFC
            </button>
          </div>
        </>
      )}
    </div>
  );
};
