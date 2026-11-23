import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, HelpCircle, RefreshCcw, XCircle, AlertTriangle, type LucideIcon } from 'lucide-react';
import type { NirnayADR, DecisionStatus } from '../../../core/types.js';
import { useSimulationStore } from '../../store/useSimulationStore.js';

export interface StitchNodeDataProps extends NirnayADR {
  isSelected?: boolean;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isOrphaned?: boolean;
  isSimulationMode?: boolean;
}

const statusConfig: Record<DecisionStatus, { label: string; glow: string; icon: LucideIcon; color: string }> = {
  accepted: { label: 'Accepted', glow: 'var(--glow-siddha)', icon: CheckCircle2, color: '#10b981' },
  proposed: { label: 'Proposed', glow: 'var(--glow-vichar)', icon: HelpCircle, color: '#f59e0b' },
  superseded: { label: 'Superseded', glow: 'var(--glow-parivartan)', icon: RefreshCcw, color: '#818cf8' },
  deprecated: { label: 'Deprecated', glow: 'var(--glow-tyakta)', icon: XCircle, color: '#f43f5e' },
};

export const StitchNodeCard = memo(({ data }: NodeProps<Node<StitchNodeDataProps>>) => {
  const { setOverride } = useSimulationStore();
  const config = statusConfig[data.status];
  const Icon = config.icon;

  const handleSimulateDeprecate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOverride(data.id, { status: data.status === 'deprecated' ? 'accepted' : 'deprecated' });
  };

  const activeGlow = data.isSelected ? 'var(--glow-active)' : config.glow;
  const isCascade = data.isOrphaned;

  return (
    <div className="relative">
      <div 
        className={`absolute inset-0 -z-10 rounded-2xl blur-2xl transition-all duration-700 ${data.isSelected || isCascade ? 'opacity-50' : 'opacity-10'}`}
        style={{ backgroundColor: isCascade ? 'var(--glow-tyakta)' : activeGlow }}
      />

      <AnimatePresence>
        {isCascade && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 2.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border-[3px] border-[var(--glow-tyakta)] z-[-5]"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.1}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        style={{
          opacity: data.isDimmed ? 0.2 : 1,
          willChange: 'transform'
        }}
        className={`group relative w-[320px] rounded-2xl bg-[var(--bg-surface-glass)] backdrop-blur-2xl p-5 overflow-hidden transition-colors duration-300 ${
          isCascade ? 'ring-2 ring-[var(--glow-tyakta)]' : (data.isSelected ? 'ring-1 ring-[var(--glow-active)]' : 'ring-1 ring-[var(--border-subtle)] hover:ring-[var(--border-highlight)]')
        }`}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
             style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.01) 100%)' }} />

        <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)] opacity-0 group-hover:opacity-100" />

        <div className="flex items-start justify-between mb-3 relative z-10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{data.category}</span>
            <span className="text-xs font-mono text-slate-400 bg-black/60 px-2 py-0.5 rounded-md border border-white/10 shadow-inner">
              {data.id}
            </span>
          </div>
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-black/20 backdrop-blur-md"
            style={{ color: config.glow, borderColor: `${config.color}40` }}
          >
            <Icon size={12} strokeWidth={3} />
            <span className="text-[10px] font-bold uppercase tracking-wide">{config.label}</span>
          </div>
        </div>

        <h3 className="text-base font-semibold text-slate-100 leading-snug mb-4 line-clamp-2 relative z-10">
          {data.title}
        </h3>

        {data.isSimulationMode && (
          <button
            onClick={handleSimulateDeprecate}
            className="absolute -top-3 -right-3 bg-slate-800 text-xs px-2 py-1 rounded-lg border border-slate-600 hover:bg-slate-700 z-20 text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          >
            {data.status === 'deprecated' ? 'Restore' : 'Simulate Deprecate'}
          </button>
        )}

        {isCascade && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            className="mt-2 text-[10px] font-bold tracking-wide uppercase text-[#f43f5e] bg-[#f43f5e]/10 border border-[#f43f5e]/30 px-2 py-1.5 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(244,63,94,0.3)] relative z-10"
          >
            <AlertTriangle size={12} />
            Dependent on Deprecated Node
          </motion.div>
        )}

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 relative z-10">
          <span className="text-[10px] text-slate-500 font-medium">{data.timestamp}</span>
          <div className="flex gap-2">
            {data.dependencies.length > 0 && (
              <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                <RefreshCcw size={10} /> {data.dependencies.length} deps
              </span>
            )}
          </div>
        </div>

        <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-slate-700 !border-slate-500 transition-colors group-hover:!bg-[var(--glow-active)] opacity-0 group-hover:opacity-100" />
      </motion.div>
    </div>
  );
});
