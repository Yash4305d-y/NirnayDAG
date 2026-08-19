import { ShieldAlert } from 'lucide-react';

interface BlastRadiusOverlayProps {
  impactedCount: number;
}

export function BlastRadiusOverlay({ impactedCount }: BlastRadiusOverlayProps) {
  if (impactedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-3 px-6 py-3 bg-tyakta/10 backdrop-blur-xl border border-tyakta/30 rounded-2xl shadow-[0_0_40px_rgba(244,63,94,0.2)] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <ShieldAlert className="w-5 h-5 text-tyakta animate-pulse" />
      <span className="text-sm font-medium text-tyakta">
        Blast Radius: <span className="font-bold text-lg">{impactedCount}</span> downstream decisions impacted
      </span>
    </div>
  );
}
