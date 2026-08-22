import React from 'react';
import { Search, Filter, Layers, FolderGit2, Activity } from 'lucide-react';
import type { DecisionStatus } from '../../core/types.js';

export interface FilterState {
  search: string;
  status: DecisionStatus[];
  category: string;
}

interface GraphToolbarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onOpenSourceModal?: () => void;
  onToggleSimulator?: () => void;
  isSimulatorOpen?: boolean;
}

const CATEGORIES = ['All', 'Infrastructure', 'Database', 'AI / Engine', 'Security'];
const STATUSES: DecisionStatus[] = ['accepted', 'proposed', 'deprecated', 'superseded'];

export const GraphToolbar: React.FC<GraphToolbarProps> = ({ filters, onFilterChange, onOpenSourceModal, onToggleSimulator, isSimulatorOpen }) => {
  
  const toggleStatus = (st: DecisionStatus) => {
    const newStatuses = filters.status.includes(st)
      ? filters.status.filter(s => s !== st)
      : [...filters.status, st];
    onFilterChange({ ...filters, status: newStatuses });
  };

  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-[#0b0f19]/80 backdrop-blur-md border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-auto">
      
      {/* Search Input */}
      <div className="flex items-center gap-2 bg-black/40 border border-white/[0.06] rounded-lg px-3 py-1.5 min-w-[200px]">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search ADRs..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 w-full"
        />
      </div>

      <div className="w-px h-6 bg-white/[0.08]" />

      {/* Category Dropdown (Simplified as Select) */}
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-slate-400" />
        <select
          value={filters.category}
          onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
          className="bg-black/40 border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-slate-300 outline-none cursor-pointer appearance-none"
        >
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="w-px h-6 bg-white/[0.08]" />

      {/* Status Pills */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        <div className="p-0.5 rounded-lg bg-black/40 border border-white/[0.06] flex items-center gap-0.5">
          {STATUSES.map(st => {
            const isActive = filters.status.includes(st);
            return (
              <button
                key={st}
                onClick={() => toggleStatus(st)}
                className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition-all ${
                  isActive
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/[0.08]'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-px h-6 bg-white/[0.08]" />

      <div className="flex items-center gap-2">
        {onToggleSimulator && (
          <button
            onClick={onToggleSimulator}
            className={`h-8 px-3 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ${
              isSimulatorOpen 
                ? 'text-amber-300 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                : 'text-slate-300 hover:text-white border-white/[0.08]'
            }`}
          >
            <Activity size={14} />
            {isSimulatorOpen ? 'Exit Sim' : 'What-If Sim'}
          </button>
        )}
        
        {onOpenSourceModal && (
          <button
            onClick={onOpenSourceModal}
            className="h-8 px-3 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
          >
            <FolderGit2 size={14} /> Load Source
          </button>
        )}
      </div>
    </div>
  );
};
