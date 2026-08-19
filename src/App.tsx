import React, { useState } from 'react';
import { NirnayCanvas } from './components/NirnayCanvas.js';
import { parseADRMarkdown } from './parser/adrParser.js';
import type { NirnayADR } from './core/types.js';

export function App() {
  const [loadedAdrs, setLoadedAdrs] = useState<NirnayADR[] | null>(null);

  const handleLoadFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      const adrs: NirnayADR[] = [];
      
      // @ts-ignore
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const file = await entry.getFile();
          const content = await file.text();
          try {
            adrs.push(parseADRMarkdown(content));
          } catch (e) {
            console.warn(`Failed to parse ${entry.name}:`, e);
          }
        }
      }
      
      if (adrs.length > 0) {
        setLoadedAdrs(adrs);
      } else {
        alert("No valid markdown ADRs found in the selected folder.");
      }
    } catch (e) {
      console.error("User cancelled or API not supported", e);
    }
  };

  return (
    <div className="w-full h-screen bg-[#05070B] overflow-hidden relative font-sans text-slate-200">
      <NirnayCanvas customAdrs={loadedAdrs} />
      
      <div className="absolute top-6 right-6 z-50">
        <button
          onClick={handleLoadFolder}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface-glass)] hover:bg-white/10 backdrop-blur-2xl border border-[var(--border-subtle)] rounded-lg transition-colors font-semibold text-sm shadow-lg text-[var(--glow-active)]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><polyline points="12 10 12 16 15 13"/><polyline points="9 13 12 16"/></svg>
          Load Local Folder
        </button>
      </div>
    </div>
  );
}
