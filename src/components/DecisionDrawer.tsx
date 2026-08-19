import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Clock, XCircle, AlertCircle, ArrowRight } from 'lucide-react';
import type { NirnayNode } from '../core/types';
import { clsx } from 'clsx';

interface DecisionDrawerProps {
  node: NirnayNode | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNode: (id: string) => void;
}

export function DecisionDrawer({ node, isOpen, onClose, onNavigateToNode }: DecisionDrawerProps) {
  if (!node) return null;

  const isAccepted = node.status === 'accepted';
  const isProposed = node.status === 'proposed';
  const isSuperseded = node.status === 'superseded';
  const isDeprecated = node.status === 'deprecated';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-obsidian/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-4 bottom-4 right-4 z-50 w-[450px] bg-panel backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/[0.08]">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono text-gray-400 bg-white/[0.05] px-2 py-1 rounded border border-white/[0.1]">
                  {node.id}
                </span>
                <span className={clsx(
                  'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border flex items-center space-x-1',
                  {
                    'bg-siddha-emerald/10 text-siddha-emerald border-siddha-emerald/20': isAccepted,
                    'bg-vichar/10 text-vichar border-vichar/20': isProposed,
                    'bg-parivartan/10 text-parivartan border-parivartan/20': isSuperseded,
                    'bg-tyakta/10 text-tyakta border-tyakta/20': isDeprecated,
                  }
                )}>
                  {isAccepted && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {isProposed && <Clock className="w-3 h-3 mr-1" />}
                  {isSuperseded && <AlertCircle className="w-3 h-3 mr-1" />}
                  {isDeprecated && <XCircle className="w-3 h-3 mr-1" />}
                  {node.status}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.1] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 hide-scrollbar">
              <h2 className="text-2xl font-bold text-white mb-6 leading-tight">
                {node.title}
              </h2>

              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Context</h3>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-gray-300 text-sm leading-relaxed">
                    {node.context}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Decision</h3>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-gray-200 text-sm leading-relaxed font-medium">
                    {node.decision}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Consequences Matrix</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-siddha-emerald/5 border border-siddha-emerald/20">
                      <h4 className="text-xs font-bold text-siddha-emerald mb-3 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-2" /> Positive
                      </h4>
                      <ul className="space-y-2">
                        {node.consequences.positive.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start">
                            <span className="text-siddha-emerald mr-2">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-tyakta/5 border border-tyakta/20">
                      <h4 className="text-xs font-bold text-tyakta mb-3 flex items-center">
                        <XCircle className="w-3 h-3 mr-2" /> Negative
                      </h4>
                      <ul className="space-y-2">
                        {node.consequences.negative.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start">
                            <span className="text-tyakta mr-2">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>

                {(node.dependencies.length > 0 || node.supersedes) && (
                  <section>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Lineage</h3>
                    <div className="flex flex-wrap gap-2">
                      {node.dependencies.map(dep => (
                        <button
                          key={dep}
                          onClick={() => onNavigateToNode(dep)}
                          className="flex items-center px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] text-xs font-mono text-gray-300 transition-colors"
                        >
                          <ArrowRight className="w-3 h-3 mr-2 text-gray-500" />
                          {dep}
                        </button>
                      ))}
                      {node.supersedes && (
                        <button
                          onClick={() => onNavigateToNode(node.supersedes!)}
                          className="flex items-center px-3 py-1.5 rounded-lg bg-parivartan/10 border border-parivartan/30 hover:bg-parivartan/20 text-xs font-mono text-parivartan transition-colors"
                        >
                          <AlertCircle className="w-3 h-3 mr-2" />
                          Supersedes {node.supersedes}
                        </button>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-white/[0.08] bg-white/[0.02]">
              <div className="text-[10px] text-gray-500 flex justify-between items-center">
                <span>Record Timestamp</span>
                <span className="font-mono">{new Date(node.timestamp).toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
