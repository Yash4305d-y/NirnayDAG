import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, GitBranch, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { NirnayADR } from '../core/types.js';
import { loadViaDirectoryPicker, loadViaFileInput } from '../utils/localFolderLoader.js';
import { fetchAdrsFromGitHub } from '../utils/githubLoader.js';
import type { ToastConfig } from './Toast.js';

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (adrs: NirnayADR[], count: number, errors: any[]) => void;
  showToast: (toast: ToastConfig) => void;
}

export const SourceModal: React.FC<SourceModalProps> = ({ isOpen, onClose, onImport, showToast }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');
  
  // Local State
  const [isLocalLoading, setIsLocalLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GitHub State
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('adrs');
  const [token, setToken] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleLocalImport = async () => {
    setIsLocalLoading(true);
    try {
      const res = await loadViaDirectoryPicker();
      if (res.adrs.length > 0) {
        onImport(res.adrs, res.count, res.errors);
      } else if (res.errors.length > 0) {
        showToast({ type: 'error', title: 'Import Failed', subtitle: res.errors[0].message });
      }
    } catch (e: any) {
      if (e.message && e.message.includes('supported')) {
         fileInputRef.current?.click();
      } else {
         showToast({ type: 'error', title: 'Import Error', subtitle: e.message });
      }
    }
    setIsLocalLoading(false);
  };

  const handleFallbackInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsLocalLoading(true);
    const res = await loadViaFileInput(e.target.files);
    if (res.adrs.length > 0) {
      onImport(res.adrs, res.count, res.errors);
    } else if (res.errors.length > 0) {
      showToast({ type: 'error', title: 'Import Failed', subtitle: res.errors[0].message });
    }
    setIsLocalLoading(false);
  };

  const handleGithubImport = async () => {
    if (!repoUrl.trim()) {
      showToast({ type: 'warning', title: 'Missing URL', subtitle: 'Please enter a valid GitHub repository URL.' });
      return;
    }
    setIsGithubLoading(true);
    const res = await fetchAdrsFromGitHub({ repoUrl, branch, path, token });
    setIsGithubLoading(false);
    
    if (res.adrs.length > 0) {
      onImport(res.adrs, res.adrs.length, res.errors);
    } else if (res.errors.length > 0) {
      showToast({ type: 'error', title: 'GitHub Fetch Failed', subtitle: res.errors[0] });
    } else {
      showToast({ type: 'warning', title: 'No ADRs Found', subtitle: 'Could not find any .md files in the specified path.' });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-md bg-[#0b0e17] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-200"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold tracking-wide uppercase text-white">Connect Source</h3>
              <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex p-2 gap-2 border-b border-white/[0.04]">
              <button
                onClick={() => setActiveTab('local')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'local' ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5 text-slate-400'
                }`}
              >
                <FolderOpen size={14} /> Local Folder
              </button>
              <button
                onClick={() => setActiveTab('github')}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  activeTab === 'github' ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-white/5 text-slate-400'
                }`}
              >
                <GitBranch size={14} /> GitHub Repo
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'local' ? (
                <div className="flex flex-col items-center justify-center gap-4">
                  <input
                    type="file"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFallbackInput}
                  />
                  <div
                    onClick={handleLocalImport}
                    className="w-full h-32 border-2 border-dashed border-cyan-500/30 rounded-xl bg-cyan-500/5 hover:bg-cyan-500/10 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    {isLocalLoading ? (
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    ) : (
                      <>
                        <FolderOpen className="w-8 h-8 text-cyan-400" />
                        <span className="text-sm font-semibold text-cyan-200">Click to Browse Local Folder</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    Select a directory containing .md ADRs. Supported formats will be recursively parsed.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Repository URL or Slug</label>
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      placeholder="e.g. facebook/react"
                      className="w-full bg-[#131926] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div className="border border-white/[0.08] rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="w-full px-3 py-2 bg-[#131926] flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors"
                    >
                      Advanced Settings
                      {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {showAdvanced && (
                      <div className="p-3 bg-[#0b0e17] flex flex-col gap-3 border-t border-white/[0.08]">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Branch</label>
                            <input
                              type="text"
                              value={branch}
                              onChange={(e) => setBranch(e.target.value)}
                              className="w-full bg-[#131926] border border-white/[0.1] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Path</label>
                            <input
                              type="text"
                              value={path}
                              onChange={(e) => setPath(e.target.value)}
                              className="w-full bg-[#131926] border border-white/[0.1] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Personal Access Token (Optional)</label>
                          <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="w-full bg-[#131926] border border-white/[0.1] rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGithubImport}
                    disabled={isGithubLoading}
                    className="w-full py-2.5 mt-2 bg-cyan-500 text-cyan-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors disabled:opacity-50"
                  >
                    {isGithubLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                    {isGithubLoading ? 'Fetching Graph...' : 'Fetch & Build DAG'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
