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
}

const statusConfig: Record<DecisionStatus, { label: string; color: string; border: string; glow: string; icon: any }> = {
  accepted: {
    label: 'Accepted',
    color: 'text-[var(--glow-siddha)] bg-[#10b981]/10',
    border: 'border-[#10b981]/30',
    glow: 'group-hover:border-[#10b981]/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    icon: CheckCircle2,
  },
  proposed: {
    label: 'Proposed',
    color: 'text-[var(--glow-vichar)] bg-[#f59e0b]/10',
    border: 'border-[#f59e0b]/30',
    glow: 'group-hover:border-[#f59e0b]/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    icon: HelpCircle,
  },
  superseded: {
    label: 'Superseded',
    color: 'text-[var(--glow-parivartan)] bg-[#818cf8]/10',
    border: 'border-[#818cf8]/30',
    glow: 'group-hover:border-[#818cf8]/60 shadow-[0_0_20px_rgba(129,140,248,0.15)]',
    icon: RefreshCcw,
  },
  deprecated: {
    label: 'Deprecated',
    color: 'text-[var(--glow-tyakta)] bg-[#f43f5e]/10',
    border: 'border-[#f43f5e]/30',
    glow: 'group-hover:border-[#f43f5e]/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    icon: XCircle,
  },
};

export const DecisionNode = memo(({ data }: NodeProps<NodeDataProps>) => {
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
      className={`group relative w-[320px] rounded-2xl bg-[var(--bg-surface-glass)] backdrop-blur-xl border ${
        data.isSelected ? 'border-[var(--glow-active)] shadow-[0_0_30px_rgba(6,182,212,0.3)]' : config.border
      } p-5 transition-all duration-300 ${config.glow} ${
        data.isHighlighted || data.isOrphaned ? 'ring-2 ring-[var(--glow-tyakta)] shadow-[0_0_40px_rgba(244,63,94,0.4)] animate-pulse' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)]" />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{data.category}</span>
          <span className="text-xs font-mono text-slate-400 bg-black/40 px-2 py-0.5 rounded-md w-fit border border-white/5">
            {data.id}
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${config.color}`}>
          <Icon size={12} strokeWidth={3} />
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

      {/* Footer Meta */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <span className="text-[10px] text-slate-500 font-medium">{data.timestamp}</span>
        <div className="flex gap-2">
          {data.dependencies.length > 0 && (
            <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
              <RefreshCcw size={10} /> {data.dependencies.length} deps
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)]" />
    </motion.div>
  );
});
