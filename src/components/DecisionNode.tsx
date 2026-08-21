import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { CheckCircle2, HelpCircle, RefreshCcw, XCircle, AlertTriangle } from 'lucide-react';
import type { NirnayADR, DecisionStatus } from '../core/types.js';
import { useSimulationStore } from '../store/useSimulationStore.js';

export interface NodeDataProps extends NirnayADR {
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isOrphaned?: boolean;
  isSimulationMode?: boolean;
  isTargeted?: boolean;
  isAffected?: boolean;
}

const statusConfig: Record<DecisionStatus, { label: string; container: string; dot: string; glow: string }> = {
  accepted: {
    label: 'Accepted',
    container: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    dot: 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse',
    glow: 'group-hover:border-[#10b981]/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
  },
  proposed: {
    label: 'Proposed',
    container: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
    dot: 'bg-sky-400 shadow-[0_0_8px_#38bdf8]',
    glow: 'group-hover:border-[#0ea5e9]/60 shadow-[0_0_20px_rgba(14,165,233,0.15)]',
  },
  superseded: {
    label: 'Superseded',
    container: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    glow: 'group-hover:border-[#f59e0b]/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  },
  deprecated: {
    label: 'Deprecated',
    container: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    dot: 'bg-rose-400 shadow-[0_0_8px_#fb7185]',
    glow: 'group-hover:border-[#f43f5e]/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
  },
};

// @ts-ignore
export const DecisionNode = memo(({ data }: NodeProps<any>) => {
  const { setOverride } = useSimulationStore();
  const config = statusConfig[data.status];
  const Icon = config.icon;

  const handleSimulateDeprecate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOverride(data.id, { status: data.status === 'deprecated' ? 'accepted' : 'deprecated' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: data.isDimmed ? 0.3 : 1, scale: data.isSelected ? 1.05 : 1 }}
      className={`group relative w-[320px] rounded-xl bg-[#0d121f]/90 hover:bg-[#111827] border ${
        data.isSelected ? 'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]' : 'border-white/[0.08] hover:border-white/[0.2]'
      } p-5 transition-all duration-200 ${
        data.isHighlighted || data.isOrphaned ? 'ring-2 ring-rose-500 shadow-[0_0_40px_rgba(244,63,94,0.4)] animate-pulse' : ''
      } ${
        data.isTargeted ? 'ring-2 ring-amber-500 shadow-[0_0_40px_rgba(245,158,11,0.5)] animate-pulse' : ''
      } ${
        data.isAffected ? 'bg-rose-950/30 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)]" />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] tracking-wider text-slate-400 uppercase mb-1">{data.category}</span>
          <span className="text-xs font-mono text-slate-300 bg-white/[0.04] px-2 py-0.5 rounded-md w-fit border border-white/[0.06]">
            {data.id}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${config.container}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
          <span className="text-[10px] font-bold uppercase tracking-wide">{config.label}</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-slate-100 leading-snug mb-4 line-clamp-2">
        {data.title}
      </h3>

      {data.isSimulationMode && (
        <button
          onClick={handleSimulateDeprecate}
          className="absolute -top-3 -right-3 bg-slate-800 text-xs px-2 py-1 rounded-lg border border-slate-600 hover:bg-slate-700 z-10 text-white shadow-lg"
        >
          {data.status === 'deprecated' ? 'Restore' : 'Deprecate'}
        </button>
      )}

      {/* Simulation Warning Badge */}
      {data.isOrphaned && (
        <div className="mt-2 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-md flex items-center gap-1">
          <AlertTriangle size={12} />
          Downstream Impact Detected
        </div>
      )}

      {data.isAffected && (
        <div className="mt-2 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-md flex items-center gap-1">
          <AlertTriangle size={12} />
          Simulated Downstream Impact
        </div>
      )}

      {/* Footer Meta */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/[0.08]">
        <span className="text-[10px] text-slate-500 font-medium">{data.timestamp}</span>
        <div className="flex gap-2">
          {data.dependencies.length > 0 && (
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-500/20">
              ⚡ {data.dependencies.length} deps
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)]" />
    </motion.div>
  );
});
