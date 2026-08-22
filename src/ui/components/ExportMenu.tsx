import React, { useState } from 'react';
import { Download, Image as ImageIcon, Code, FileJson, Loader2 } from 'lucide-react';

interface ExportMenuProps {
  onExportPng: () => Promise<void>;
  onExportSvg: () => Promise<void>;
  onExportJson: () => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({ onExportPng, onExportSvg, onExportJson }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (type: 'png' | 'svg' | 'json') => {
    setIsExporting(true);
    setIsOpen(false);
    try {
      if (type === 'png') await onExportPng();
      if (type === 'svg') await onExportSvg();
      if (type === 'json') onExportJson();
    } catch (err) {
      console.error("Export failed", err);
    }
    setIsExporting(false);
  };

  return (
    <div className="relative pointer-events-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d111a]/85 hover:bg-[#131926] border border-white/[0.08] hover:border-cyan-500/40 text-xs font-mono text-slate-200 transition-all duration-200 shadow-2xl disabled:opacity-50"
      >
        {isExporting ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> : <Download className="w-4 h-4 text-cyan-400" />}
        <span>Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#0b0e17]/95 border border-white/[0.1] rounded-xl shadow-2xl backdrop-blur-2xl overflow-hidden z-50">
          <div className="flex flex-col py-1">
            <button
              onClick={() => handleExport('png')}
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              High-Res PNG
            </button>
            <button
              onClick={() => handleExport('svg')}
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <Code className="w-4 h-4 text-fuchsia-400" />
              Vector SVG
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <FileJson className="w-4 h-4 text-amber-400" />
              Raw JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
