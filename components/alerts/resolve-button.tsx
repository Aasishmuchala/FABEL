'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { resolveAlertAction } from '@/app/alerts/actions';
import { cn } from '@/lib/format';

export function ResolveButton({ alertId }: { alertId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resolveAlertAction(alertId);
        })
      }
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-text transition-colors',
        pending
          ? 'cursor-default opacity-60'
          : 'hover:border-teal/40 hover:text-teal',
      )}
    >
      <Check size={14} aria-hidden />
      {pending ? 'Resolving…' : 'Mark resolved'}
    </button>
  );
}
