import React, { useState } from 'react';
import { NirnayCanvas } from './components/NirnayCanvas.js';
import type { NirnayADR } from './core/types.js';
import { loadLocalADRs } from './utils/localFolderLoader.js';

export function App() {
  const [loadedAdrs, setLoadedAdrs] = useState<NirnayADR[] | null>(null);

  const handleLoadFolder = async () => {
    const adrs = await loadLocalADRs();
    if (adrs) {
      setLoadedAdrs(adrs);
    } else {
      alert("No valid markdown ADRs found in the selected folder, or action cancelled.");
    }
  };

  return (
    <div className="w-full h-screen bg-[var(--bg-deep-obsidian)] overflow-hidden relative font-sans text-slate-200">
      <NirnayCanvas customAdrs={loadedAdrs} />
      
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleLoadFolder}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface-glass)] hover:bg-white/10 backdrop-blur-2xl border border-[var(--border-subtle)] rounded-lg transition-colors font-semibold text-sm shadow-lg text-[var(--glow-active)] hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] pointer-events-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><polyline points="12 10 12 16 15 13"/><polyline points="9 13 12 16"/></svg>
          Load Local Folder
        </button>
      </div>
    </div>
  );
}
