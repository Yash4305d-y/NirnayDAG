import React, { useMemo } from 'react';
import { Activity, RefreshCw, Download, ChevronDown, ShieldAlert } from 'lucide-react';
import type { ParsedADR, BlastRadiusMap } from '../../core/types.js';
import { calculateArchitectureRisk } from '../../core/risk.js';

interface SimulatorDockProps {
  isOpen: boolean;
  onToggle: () => void;
  adrs: ParsedADR[];
  simulatedDeprecatedIds: string[];
  blastRadiusMap: BlastRadiusMap;
  onToggleSimulateDeprecate: (id: string) => void;
  onResetSimulation: () => void;
}

export const SimulatorDock: React.FC<SimulatorDockProps> = ({
  isOpen,
  onToggle,
  adrs,
  simulatedDeprecatedIds,
  blastRadiusMap,
  onToggleSimulateDeprecate,
  onResetSimulation
}) => {
  // Compute counts
  const overrideCount = simulatedDeprecatedIds.length;
  
  const affectedCount = useMemo(() => {
    const corridor = new Set<string>();
    simulatedDeprecatedIds.forEach(id => {
      if (blastRadiusMap[id]) {
        blastRadiusMap[id].totalCascade.forEach(depId => corridor.add(depId));
      }
    });
    return corridor.size;
  }, [simulatedDeprecatedIds, blastRadiusMap]);

  const directDependentsCount = useMemo(() => {
    const directSet = new Set<string>();
    simulatedDeprecatedIds.forEach(id => {
      if (blastRadiusMap[id]) {
        blastRadiusMap[id].directDependents.forEach(depId => directSet.add(depId));
      }
    });
    return directSet.size;
  }, [simulatedDeprecatedIds, blastRadiusMap]);
  
  // Unified architecture risk calculation (v2)
  const risk = useMemo(() => {
    return calculateArchitectureRisk({
      version: 'v2',
      directDependentsCount,
      cascadeCount: affectedCount,
      totalNodes: adrs.length,
    });
  }, [directDependentsCount, affectedCount, adrs.length]);

  const riskScore = risk.score;
  const riskLevel = risk.level;
  const riskColor = riskScore > 60 ? 'text-rose-400 border-rose-500/30 bg-rose-500/10' 
                  : riskScore > 30 ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                  : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

  const handleExport = () => {
    const reportContent = `# Architecture Impact Simulation Report\n\nGenerated at: ${new Date().toISOString()}\n\n## Summary\n- Simulated Deprecations: ${overrideCount}\n- Estimated Downstream Impact: ${affectedCount} systems\n- Architecture Risk Score: ${riskScore}/100 (${riskLevel})\n\n## Details\n${simulatedDeprecatedIds.map(id => `- **${id}**: Marked as deprecated`).join('\n')}`;
    const blob = new Blob([reportContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impact-report-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#0a0d14]/95 border-t border-cyan-500/20 backdrop-blur-xl transition-all duration-300 ease-in-out ${
        isOpen ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 py-5 relative">
        <button 
          onClick={onToggle}
          className="absolute top-4 right-6 p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronDown size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
            <Activity size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">Architecture What-If Simulator</h2>
            <p className="text-sm text-slate-400">Test the blast radius of deprecating existing systems.</p>
          </div>
        </div>

        <div className="flex gap-6 h-64">
          {/* Left Column: ADR List */}
          <div className="flex-1 bg-black/40 border border-white/5 rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 border-b border-white/5 bg-white/5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Loaded Decisions
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {adrs.length === 0 && (
                <div className="text-sm text-slate-500 italic p-2">No ADRs loaded.</div>
              )}
              {adrs.map(adr => {
                const isDeprecated = simulatedDeprecatedIds.includes(adr.frontmatter.id);
                return (
                  <div key={adr.frontmatter.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isDeprecated ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}>
                    <div className="flex flex-col truncate pr-4">
                      <span className="font-mono text-xs font-bold text-cyan-400">{adr.frontmatter.id}</span>
                      <span className="text-sm text-slate-200 truncate">{adr.frontmatter.title}</span>
                    </div>
                    <button
                      onClick={() => onToggleSimulateDeprecate(adr.frontmatter.id)}
                      className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        isDeprecated 
                          ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' 
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {isDeprecated ? 'Restore' : 'Simulate Deprecate'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Impact Analysis */}
          <div className="w-80 shrink-0 bg-black/40 border border-white/5 rounded-xl p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400" />
              Impact Analysis
            </h3>

            <div className="space-y-4 flex-1">
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Targeted Systems</span>
                <span className="font-mono text-lg font-bold text-amber-400">{overrideCount}</span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-white/5">
                <span className="text-sm text-slate-400">Downstream Affected</span>
                <span className="font-mono text-lg font-bold text-rose-400">{affectedCount}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Risk Level</span>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${riskColor}`}>
                  {riskLevel}
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-4 pt-4 border-t border-white/5">
              <button 
                onClick={onResetSimulation}
                className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} /> Reset
              </button>
              <button 
                onClick={handleExport}
                disabled={overrideCount === 0}
                className="flex-1 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
