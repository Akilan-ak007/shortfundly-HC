import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
      case 'info': return <Info className="h-5 w-5 text-primary-500 shrink-0" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case 'success': return 'border-emerald-500/20 bg-emerald-50/90 dark:bg-emerald-950/20';
      case 'warning': return 'border-amber-500/20 bg-amber-50/90 dark:bg-amber-950/20';
      case 'error': return 'border-red-500/20 bg-red-50/90 dark:bg-red-950/20';
      case 'info': return 'border-primary-500/20 bg-primary-50/90 dark:bg-primary-950/20';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Floating stacked Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md
              transition-all duration-300 transform translate-y-0 animate-slide-in
              ${getBorderColor(toast.type)}
            `}
          >
            {getIcon(toast.type)}
            <div className="flex-1 text-sm font-medium pr-2 text-slate-800 dark:text-dark-100">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:text-dark-500 dark:hover:text-dark-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
