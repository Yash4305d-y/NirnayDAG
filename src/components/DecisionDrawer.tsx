import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, CheckCircle2, Zap, AlertTriangle, ArrowRight } from 'lucide-react';
import type { NirnayADR } from '../core/types.js';

interface DecisionDrawerProps {
  adr: NirnayADR | null;
  impactedIds: string[];
  onClose: () => void;
  onSelectNode: (id: string) => void;
}

export const DecisionDrawer: React.FC<DecisionDrawerProps> = ({
  adr,
  impactedIds,
  onClose,
  onSelectNode,
}) => {
  return (
    <AnimatePresence>
      {adr && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed top-4 right-4 bottom-4 w-[400px] z-40 flex flex-col rounded-2xl bg-[#0b0e17]/95 border border-white/[0.08] backdrop-blur-2xl p-6 shadow-2xl overflow-y-auto text-slate-100 font-sans pointer-events-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded-md border border-cyan-400/20">
                {adr.id}
              </span>
              <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">
                {adr.category}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-snug">{adr.title}</h2>
              <p className="text-xs text-slate-400 font-mono mt-1">Date: {adr.timestamp}</p>
            </div>

            {/* Blast Radius Warning */}
            {impactedIds.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-300">Cascading Impact Alert</p>
                  <p className="text-amber-200/80 mt-0.5">
                    Modifying this choice directly cascades to {impactedIds.length} dependent decision(s):
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {impactedIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => onSelectNode(id)}
                        className="font-mono text-[11px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 px-2 py-0.5 rounded border border-amber-400/30 flex items-center gap-1 transition-colors"
                      >
                        {id} <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Problem Context */}
            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Problem Context
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.03] p-3 rounded-xl border border-white/[0.05]">
                {adr.context}
              </p>
            </div>

            {/* Decision Resolution */}
            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Architectural Resolution
              </h4>
              <p className="text-xs text-cyan-100 leading-relaxed bg-cyan-500/[0.04] p-3 rounded-xl border border-cyan-500/15">
                {adr.decision}
              </p>
            </div>

            {/* Consequences & Trade-offs */}
            <div>
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                Consequences Matrix
              </h4>
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-1.5">
                    <Zap className="w-3.5 h-3.5" /> Positive Outcomes
                  </div>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                    {adr.consequences.pros.map((pro, idx) => (
                      <li key={idx}>{pro}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/[0.04] border border-rose-500/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> Technical Debt & Trade-offs
                  </div>
                  <ul className="text-xs text-slate-300 list-disc list-inside space-y-1">
                    {adr.consequences.cons.map((con, idx) => (
                      <li key={idx}>{con}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
