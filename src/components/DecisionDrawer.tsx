import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, HelpCircle, RefreshCcw, XCircle, ArrowLeft } from 'lucide-react';
import type { NirnayADR, DecisionStatus } from '../core/types.js';

interface DecisionDrawerProps {
  adr: NirnayADR | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusConfig: Record<DecisionStatus, { label: string; color: string; icon: any }> = {
  accepted: { label: 'Accepted', color: '#10b981', icon: CheckCircle2 },
  proposed: { label: 'Proposed', color: '#f59e0b', icon: HelpCircle },
  superseded: { label: 'Superseded', color: '#818cf8', icon: RefreshCcw },
  deprecated: { label: 'Deprecated', color: '#f43f5e', icon: XCircle },
};

export const DecisionDrawer: React.FC<DecisionDrawerProps> = ({ adr, isOpen, onClose }) => {
  return (
    <AnimatePresence>
      {isOpen && adr && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-4 right-4 bottom-4 w-[400px] z-40 bg-[#0c101a]/95 border border-white/[0.08] backdrop-blur-2xl p-6 rounded-2xl shadow-2xl flex flex-col overflow-y-auto overflow-x-hidden pointer-events-auto"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
          
          <div className="flex flex-col mb-6 pt-2">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">{adr.category}</span>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono text-slate-300 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
                {adr.id}
              </span>
              <div 
                className="flex items-center gap-1 px-2 py-0.5 rounded-full border bg-black/20"
                style={{ color: statusConfig[adr.status].color, borderColor: `${statusConfig[adr.status].color}40` }}
              >
                {React.createElement(statusConfig[adr.status].icon, { size: 12 })}
                <span className="text-[10px] font-bold uppercase tracking-wide">{statusConfig[adr.status].label}</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-white leading-tight">{adr.title}</h2>
            <span className="text-xs text-slate-500 mt-2">{adr.timestamp}</span>
          </div>

          <div className="flex flex-col gap-6">
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Context</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{adr.context}</p>
            </section>
            
            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Decision</h4>
              <p className="text-sm text-slate-300 leading-relaxed">{adr.decision}</p>
            </section>

            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Consequences</h4>
              <div className="flex flex-col gap-3">
                {adr.consequences.pros.length > 0 && (
                  <div className="bg-[#10b981]/10 border border-[#10b981]/20 rounded-lg p-3">
                    <h5 className="text-[10px] font-bold text-[#10b981] uppercase tracking-widest mb-2">Pros</h5>
                    <ul className="list-disc pl-4 text-xs text-slate-300 flex flex-col gap-1">
                      {adr.consequences.pros.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {adr.consequences.cons.length > 0 && (
                  <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/20 rounded-lg p-3">
                    <h5 className="text-[10px] font-bold text-[#f43f5e] uppercase tracking-widest mb-2">Cons</h5>
                    <ul className="list-disc pl-4 text-xs text-slate-300 flex flex-col gap-1">
                      {adr.consequences.cons.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Lineage</h4>
              <div className="flex flex-col gap-2">
                {adr.dependencies.length > 0 ? (
                  <div className="flex items-start gap-2">
                    <ArrowLeft size={14} className="text-slate-500 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {adr.dependencies.map(dep => (
                        <span key={dep} className="text-xs font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{dep}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">No upstream dependencies</span>
                )}
              </div>
            </section>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
