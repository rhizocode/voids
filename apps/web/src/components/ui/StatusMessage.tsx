import type { PayloadResult } from '@voids/shared';
import { cn } from './cn';

type Tone = 'success' | 'error' | 'info';

export interface StatusMessageProps {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}

const tones: Record<Tone, string> = {
  success: 'border-emerald-700/50 bg-emerald-900/30 text-emerald-300',
  error: 'border-red-700/50 bg-red-900/30 text-red-300',
  info: 'border-slate-700 bg-slate-800/50 text-slate-300',
};

/** A small inline status banner for showing `{code,reason}` results and errors. */
export function StatusMessage({ tone = 'info', children, className }: StatusMessageProps) {
  return (
    <div
      role="status"
      className={cn('rounded-md border px-3 py-2 text-sm', tones[tone], className)}
    >
      {children}
    </div>
  );
}

/**
 * Render a backend `{ code, reason }` payload as a status banner. Even codes
 * follow the convention that the "valid/success" outcomes are the *-VALID /
 * *-SUCCEEDED entries; we treat the specific success codes as success and the
 * rest as info, with explicit failure codes shown as errors.
 */
export function PayloadStatus({
  result,
  successCodes,
  className,
}: {
  result: PayloadResult;
  successCodes?: number[];
  className?: string;
}) {
  const isSuccess = successCodes ? successCodes.includes(result.code) : result.code >= 0;
  return (
    <StatusMessage tone={isSuccess ? 'success' : 'error'} className={className}>
      {result.reason}
    </StatusMessage>
  );
}
