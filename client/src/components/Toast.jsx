import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 4500),
    warning: (msg) => addToast(msg, 'warning', 4000),
    info: (msg) => addToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Render Viewport */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
              t.type === 'success'
                ? 'bg-white/95 border-emerald-200 text-emerald-950 shadow-emerald-500/10'
                : t.type === 'error'
                ? 'bg-white/95 border-rose-200 text-rose-950 shadow-rose-500/10'
                : t.type === 'warning'
                ? 'bg-white/95 border-amber-200 text-amber-950 shadow-amber-500/10'
                : 'bg-white/95 border-zinc-200 text-zinc-900 shadow-zinc-500/10'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {t.type === 'error' && <XCircle className="w-4 h-4 text-rose-600" />}
              {t.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {t.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
            </div>
            <div className="flex-1 text-xs font-medium leading-relaxed">{t.message}</div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
