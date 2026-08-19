import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { CheckCircle2, HelpCircle, RefreshCcw, XCircle, Sparkles } from 'lucide-react';
import type { NirnayADR, DecisionStatus } from '../core/types';

interface NodeDataProps extends NirnayADR {
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

export type DecisionNodeType = Node<NodeDataProps, 'decision'>;

const statusConfig: Record<DecisionStatus, { label: string; color: string; border: string; glow: string; icon: any }> = {
  accepted: {
    label: 'Accepted',
    color: 'text-emerald-400 bg-emerald-500/10',
    border: 'border-emerald-500/30',
    glow: 'group-hover:border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    icon: CheckCircle2,
  },
  proposed: {
    label: 'Proposed',
    color: 'text-amber-400 bg-amber-500/10',
    border: 'border-amber-500/30',
    glow: 'group-hover:border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    icon: HelpCircle,
  },
  superseded: {
    label: 'Superseded',
    color: 'text-indigo-400 bg-indigo-500/10',
    border: 'border-indigo-500/30',
    glow: 'group-hover:border-indigo-400/60 shadow-[0_0_20px_rgba(99,102,241,0.15)]',
    icon: RefreshCcw,
  },
  deprecated: {
    label: 'Deprecated',
    color: 'text-rose-400 bg-rose-500/10',
    border: 'border-rose-500/30',
    glow: 'group-hover:border-rose-400/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    icon: XCircle,
  },
};

export const DecisionNode = memo(({ data, selected }: NodeProps<DecisionNodeType>) => {
  const currentStatus = statusConfig[data.status] || statusConfig.proposed;
  const StatusIcon = currentStatus.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: data.isDimmed ? 0.25 : 1, 
        scale: selected ? 1.04 : 1 
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`group relative min-w-[280px] max-w-[320px] rounded-2xl border backdrop-blur-2xl p-4 transition-all duration-300
        ${selected ? 'border-cyan-400/80 shadow-[0_0_30px_rgba(6,182,212,0.3)] bg-[#0e121e]/90 z-50' : `${currentStatus.border} ${currentStatus.glow} bg-[#0b0e17]/80 z-0`}
        ${data.isHighlighted ? 'ring-2 ring-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-cyan-400 !border-2 !border-[#090a0f] transition-transform group-hover:scale-125"
      />

      {/* Card Header */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="font-mono text-xs font-semibold tracking-wider text-slate-400 uppercase bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.05]">
          {data.id}
        </span>
        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${currentStatus.color} ${currentStatus.border}`}>
          <StatusIcon className="w-3 h-3" />
          <span>{currentStatus.label}</span>
        </div>
      </div>

      {/* Card Title */}
      <h3 className="font-sans text-sm font-semibold text-slate-100 leading-snug tracking-tight line-clamp-2 mb-3">
        {data.title}
      </h3>

      {/* Category & Metadata Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-slate-400">
        <span className="flex items-center gap-1 font-mono text-slate-400">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          {data.category}
        </span>
        <span className="font-mono text-slate-500">{data.timestamp}</span>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-emerald-400 !border-2 !border-[#090a0f] transition-transform group-hover:scale-125"
      />
    </motion.div>
  );
});

DecisionNode.displayName = 'DecisionNode';
