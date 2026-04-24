import React, { useEffect } from 'react';

export type ScanResultKind = 'success' | 'warning' | 'error';

interface Props {
  kind: ScanResultKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

const BG: Record<ScanResultKind, string> = {
  success: 'bg-green-600',
  warning: 'bg-yellow-500',
  error: 'bg-red-600',
};

const ScanResultToast: React.FC<Props> = ({ kind, message, actionLabel, onAction, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 ${BG[kind]} text-white px-6 py-4 rounded-xl shadow-2xl z-50 max-w-md`}>
      <div className="flex items-center gap-4">
        <span className="flex-1">{message}</span>
        {actionLabel && onAction && (
          <button onClick={onAction} className="bg-white text-slate-900 px-3 py-1 rounded text-sm font-bold">
            {actionLabel}
          </button>
        )}
        <button onClick={onClose} className="opacity-70 hover:opacity-100">✕</button>
      </div>
    </div>
  );
};

export default ScanResultToast;
