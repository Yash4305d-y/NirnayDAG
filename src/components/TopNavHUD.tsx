import { Search, Activity, Download, LayoutDashboard } from 'lucide-react';

interface TopNavHUDProps {
  onSearch: (q: string) => void;
  onExport: () => void;
  onSimulateToggle: () => void;
  isSimulating: boolean;
}

export function TopNavHUD({ onSearch, onExport, onSimulateToggle, isSimulating }: TopNavHUDProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between p-3 bg-panel backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-white/[0.03] p-2 rounded-xl border border-white/[0.05]">
          <LayoutDashboard className="w-5 h-5 text-siddha-cyan" />
          <span className="font-bold tracking-widest text-sm bg-gradient-to-r from-siddha-emerald to-siddha-cyan text-transparent bg-clip-text">
            NirnayDAG
          </span>
        </div>
        
        <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-1.5 focus-within:border-siddha-emerald/50 transition-colors">
          <Search className="w-4 h-4 text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search decisions..."
            className="bg-transparent border-none outline-none text-sm text-gray-200 placeholder-gray-500 w-64"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onSimulateToggle}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all ${
            isSimulating
              ? 'bg-tyakta/20 border-tyakta/50 text-tyakta'
              : 'bg-white/[0.03] border-white/[0.08] text-gray-300 hover:bg-white/[0.08]'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">Impact Sim</span>
        </button>

        <button
          onClick={onExport}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-300 hover:bg-white/[0.08] transition-all"
        >
          <Download className="w-4 h-4" />
          <span className="text-sm font-medium">Export</span>
        </button>
      </div>
    </div>
  );
}
