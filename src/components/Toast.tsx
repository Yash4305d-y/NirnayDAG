import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export interface ToastConfig {
  type: 'success' | 'warning' | 'error';
  title: string;
  subtitle?: string;
}

interface ToastProps {
  toast: ToastConfig | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: -20, x: 20 }}
          className="fixed top-24 right-6 z-50 flex items-start gap-4 px-4 py-3 rounded-xl bg-[#131926]/95 border border-white/[0.1] shadow-2xl backdrop-blur-xl min-w-[320px] max-w-[400px] pointer-events-auto"
        >
          <div className="mt-0.5">
            {toast.type === 'success' && <CheckCircle className="text-emerald-400 w-5 h-5" />}
            {toast.type === 'warning' && <AlertTriangle className="text-amber-400 w-5 h-5" />}
            {toast.type === 'error' && <XCircle className="text-rose-400 w-5 h-5" />}
          </div>
          <div className="flex flex-col flex-1">
            <span className={`text-sm font-semibold ${
              toast.type === 'success' ? 'text-emerald-400' :
              toast.type === 'warning' ? 'text-amber-400' :
              'text-rose-400'
            }`}>
              {toast.title}
            </span>
            {toast.subtitle && <span className="text-xs text-slate-400 mt-0.5">{toast.subtitle}</span>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white mt-0.5">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
