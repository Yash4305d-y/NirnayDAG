import React from 'react';
import { Search, Filter, Layers } from 'lucide-react';
import type { DecisionStatus } from '../core/types.js';

export interface FilterState {
  search: string;
  status: DecisionStatus[];
  category: string;
}

interface GraphToolbarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const CATEGORIES = ['All', 'Infrastructure', 'Database', 'AI / Engine', 'Security'];
const STATUSES: DecisionStatus[] = ['accepted', 'proposed', 'deprecated', 'superseded'];

export const GraphToolbar: React.FC<GraphToolbarProps> = ({ filters, onFilterChange }) => {
  
  const toggleStatus = (st: DecisionStatus) => {
    const newStatuses = filters.status.includes(st)
      ? filters.status.filter(s => s !== st)
      : [...filters.status, st];
    onFilterChange({ ...filters, status: newStatuses });
  };

  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 px-4 py-2.5 rounded-2xl bg-[#0d111a]/85 border border-white/[0.08] backdrop-blur-xl shadow-2xl pointer-events-auto">
      
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
      <div className="flex items-center gap-1.5">
        <Filter className="w-4 h-4 text-slate-400 mr-1" />
        {STATUSES.map(st => {
          const isActive = filters.status.includes(st);
          return (
            <button
              key={st}
              onClick={() => toggleStatus(st)}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-md transition-colors border ${
                isActive
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-transparent text-slate-500 border-transparent hover:bg-white/5 hover:text-slate-400'
              }`}
            >
              {st}
            </button>
          );
        })}
      </div>
    </div>
  );
};
