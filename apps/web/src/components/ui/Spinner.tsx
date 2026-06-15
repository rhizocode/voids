import { cn } from './cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400',
        className,
      )}
    />
  );
}
