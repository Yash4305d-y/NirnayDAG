import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

interface SimulatorDockProps {
  isSimulating: boolean;
  onToggleSimulation: () => void;
  impactCount: number;
}

export const SimulatorDock: React.FC<SimulatorDockProps> = ({
  isSimulating,
  onToggleSimulation,
  impactCount,
}) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2 rounded-full bg-[#0b0e17]/90 border border-white/[0.1] backdrop-blur-xl shadow-2xl pointer-events-auto">
      <div className="flex items-center gap-2 pr-3 border-r border-white/[0.08]">
        <Activity className={`w-4 h-4 ${isSimulating ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
        <span className="text-xs font-mono font-semibold text-slate-200">Simulation Engine</span>
      </div>

      <button
        onClick={onToggleSimulation}
        className={`px-3 py-1 rounded-full text-xs font-mono transition-all duration-200 ${
          isSimulating
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
            : 'bg-white/[0.05] text-slate-400 hover:text-white border border-white/[0.06]'
        }`}
      >
        {isSimulating ? 'Active' : 'Standby'}
      </button>

      {isSimulating && impactCount > 0 && (
        <span className="font-mono text-xs text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
          {impactCount} Cascade Impacts
        </span>
      )}
    </div>
  );
};
