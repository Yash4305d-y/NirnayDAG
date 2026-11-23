import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, GitBranch, UploadCloud, AlertCircle } from 'lucide-react';
import { loadFromDirectoryPicker, readFilesFromInput, isFileSystemAccessSupported } from '../../utils/localFolderLoader.js';
import { fetchGitHubADRs } from '../../utils/githubLoader.js';

interface SourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadSuccess: (files: Array<{ name: string; content: string }>) => void;
}

export const SourceModal: React.FC<SourceModalProps> = ({ isOpen, onClose, onLoadSuccess }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // GitHub Form State
  const [repoStr, setRepoStr] = useState('');
  const [branch, setBranch] = useState('main');
  const [pathStr, setPathStr] = useState('docs/adr');
  const [token, setToken] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setError(null);
      setIsLoading(false);
    }
  }

  const handleLocalDirectory = async () => {
    if (!isFileSystemAccessSupported()) {
      fileInputRef.current?.click();
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { files, errors } = await loadFromDirectoryPicker();
      if (errors.length > 0) {
        setError(errors[0]);
      } else if (files.length > 0) {
        onLoadSuccess(files);
      } else {
        setError('No Markdown files found.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load local directory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFallbackInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setError(null);
    setIsLoading(true);
    try {
      const files = await readFilesFromInput(e.target.files);
      if (files.length > 0) {
        onLoadSuccess(files);
      } else {
        setError('No Markdown files found.');
      }
    } catch (err: any) {
       setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files?.length) return;
    setError(null);
    setIsLoading(true);
    try {
      const files = await readFilesFromInput(e.dataTransfer.files as any);
      if (files.length > 0) {
        onLoadSuccess(files);
      } else {
        setError('No Markdown files found.');
      }
    } catch (err: any) {
       setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoStr.trim()) {
      setError("Please enter a valid GitHub repository");
      return;
    }
    
    let owner = '';
    let repo = '';
    
    if (repoStr.includes('github.com/')) {
       const parts = repoStr.split('github.com/')[1].split('/');
       owner = parts[0];
       repo = parts[1];
    } else {
       const parts = repoStr.split('/');
       owner = parts[0];
       repo = parts[1];
    }
    
    if (!owner || !repo) {
      setError("Invalid repository format. Use 'owner/repo' or a full URL.");
      return;
    }

    setError(null);
    setIsLoading(true);
    
    try {
      const { files, errors } = await fetchGitHubADRs({
        owner,
        repo,
        branch: branch || 'main',
        path: pathStr || '',
        token: token || undefined
      });
      
      if (errors.length > 0) {
        setError(errors[0]);
      } else if (files.length > 0) {
        onLoadSuccess(files);
      } else {
        setError("No Markdown files found in the specified repository/path.");
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch from GitHub');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-xl bg-[#0b0f19]/80 backdrop-blur-md rounded-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0">
              <h2 className="text-xl font-medium tracking-wide flex items-center gap-2 text-white">
                <span className="text-cyan-400 font-semibold drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">Load</span> Source
              </h2>
              <button 
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5 shrink-0">
              <button
                className={`flex-1 p-4 font-medium text-sm transition-all duration-200 border-b-2 flex items-center justify-center gap-2 outline-none ${
                  activeTab === 'local' 
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-900/10' 
                    : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
                }`}
                onClick={() => setActiveTab('local')}
              >
                <FolderOpen size={18} />
                Local Directory
              </button>
              <button
                className={`flex-1 p-4 font-medium text-sm transition-all duration-200 border-b-2 flex items-center justify-center gap-2 outline-none ${
                  activeTab === 'github' 
                    ? 'border-purple-500 text-purple-300 bg-purple-900/10' 
                    : 'border-transparent text-white/40 hover:text-white/80 hover:bg-white/[0.02]'
                }`}
                onClick={() => setActiveTab('github')}
              >
                <GitBranch size={18} />
                Remote GitHub
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto">
              {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 text-red-200 text-sm items-start">
                  <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              {activeTab === 'local' ? (
                <div className="flex flex-col gap-4">
                  <div 
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer border-2 border-dashed border-cyan-500/30 rounded-xl p-12 text-center bg-cyan-950/10 hover:bg-cyan-950/20 hover:border-cyan-500/50 transition-all flex flex-col items-center justify-center gap-4 group shadow-[inset_0_0_20px_rgba(6,182,212,0.02)]"
                  >
                    <div className="p-4 rounded-full bg-cyan-500/10 text-cyan-400 group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all">
                      <UploadCloud size={32} />
                    </div>
                    <div>
                      <h3 className="font-medium text-cyan-100">Drag & drop your ADR folder here</h3>
                      <p className="text-sm text-cyan-100/50 mt-1">Accepts multiple .md or .markdown files</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full my-2">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-xs font-semibold tracking-wider text-white/40 uppercase">OR</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                  </div>
                  
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFallbackInput}
                    className="hidden"
                    multiple
                    {...{ webkitdirectory: "", directory: "" } as any}
                  />
                  
                  <button 
                    onClick={handleLocalDirectory}
                    disabled={isLoading}
                    className="w-full h-10 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-medium transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-ping" />
                        <span className="font-mono text-xs tracking-wider uppercase text-cyan-200">
                          {`> Reading local files...`}
                        </span>
                      </div>
                    ) : (
                      <>
                        <FolderOpen size={16} /> 
                        {isFileSystemAccessSupported() ? 'Pick Local Folder' : 'Pick Local Folder (Fallback)'}
                      </>
                    )}
                  </button>
                  
                  {!isFileSystemAccessSupported() && (
                    <p className="text-[10px] text-center mt-2 text-cyan-200/50">
                      Using Standard Directory Picker (Browser Fallback)
                    </p>
                  )}
                </div>
              ) : (
                <form onSubmit={handleGithubSubmit} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-xs font-medium text-purple-200/60 uppercase tracking-wide mb-2">Repository</label>
                    <input 
                      type="text" 
                      placeholder="e.g. facebook/react or https://github.com/..." 
                      value={repoStr}
                      onChange={e => setRepoStr(e.target.value)}
                      className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-white placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-purple-200/60 uppercase tracking-wide mb-2">Branch</label>
                      <input 
                        type="text" 
                        placeholder="main" 
                        value={branch}
                        onChange={e => setBranch(e.target.value)}
                        className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-white placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-purple-200/60 uppercase tracking-wide mb-2">Path</label>
                      <input 
                        type="text" 
                        placeholder="docs/adr" 
                        value={pathStr}
                        onChange={e => setPathStr(e.target.value)}
                        className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-white placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-purple-200/60 uppercase tracking-wide mb-2">Personal Access Token <span className="lowercase normal-case text-white/30 tracking-normal">(Optional)</span></label>
                    <input 
                      type="password" 
                      placeholder="ghp_..." 
                      value={token}
                      onChange={e => setToken(e.target.value)}
                      className="w-full bg-black/40 border border-purple-500/30 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all text-white placeholder-white/20 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
                    />
                    <p className="text-xs text-white/40 mt-2">Required for private repositories or to avoid rate limits.</p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 h-10 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] animate-ping" />
                        <span className="font-mono text-xs tracking-wider uppercase text-purple-200">
                          {`> Fetching ADR tree...`}
                        </span>
                      </div>
                    ) : (
                      <>
                        <GitBranch size={16} /> Fetch ADRs
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
