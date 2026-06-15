import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from './cn';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Show a transient toast. Must be used under {@link ToastProvider}. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const toneClasses: Record<ToastTone, string> = {
  success: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  error: 'border-red-700 bg-red-950 text-red-200',
  info: 'border-slate-700 bg-slate-800 text-slate-200',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, tone, message }]);
    const timerId = setTimeout(() => {
      timers.current.delete(timerId);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    timers.current.add(timerId);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto max-w-sm rounded-md border px-4 py-2 text-sm shadow-lg',
              toneClasses[t.tone],
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
