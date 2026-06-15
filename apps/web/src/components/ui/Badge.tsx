import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-700 text-slate-200',
  success: 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-700/50',
  warning: 'bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/50',
  danger: 'bg-red-900/60 text-red-300 ring-1 ring-red-700/50',
  info: 'bg-indigo-900/60 text-indigo-300 ring-1 ring-indigo-700/50',
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
