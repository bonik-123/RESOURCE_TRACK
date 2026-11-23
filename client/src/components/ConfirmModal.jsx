import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, Archive, HelpCircle } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  isArchive = false,
  onConfirm,
  onClose,
  loading = false,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200/90 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start space-x-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isDanger
                  ? 'bg-rose-50 text-rose-600 border border-rose-100'
                  : isArchive
                  ? 'bg-amber-50 text-amber-600 border border-amber-100'
                  : 'bg-zinc-100 text-zinc-700'
              }`}
            >
              {isDanger ? (
                <Trash2 className="w-5 h-5" />
              ) : isArchive ? (
                <Archive className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-base font-semibold text-zinc-900 tracking-tight">{title}</h3>
              <p className="text-xs text-zinc-600 mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end space-x-2.5 pt-3 border-t border-zinc-100">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className={`px-4 py-2 text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 ${
                isDanger
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20 active:scale-[0.98]'
                  : isArchive
                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20 active:scale-[0.98]'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-900/10 active:scale-[0.98]'
              }`}
            >
              {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1" />}
              <span>{confirmText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
