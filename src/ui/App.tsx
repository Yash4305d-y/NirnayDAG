import { NirnayCanvas } from './components/NirnayCanvas.js';

export function App() {
  return (
    <div className="w-full h-screen bg-[var(--bg-deep-obsidian)] overflow-hidden relative font-sans text-slate-200">
      <NirnayCanvas />
    </div>
  );
}
