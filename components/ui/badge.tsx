import { cn } from '@/lib/format';
import type { ReconciliationFlag } from '@/lib/types';

export type BadgeVariant = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

/* Semantics law: green ok/verified, orange warn/variance/calibrating,
   red danger/tamper/offline, indigo AI. Dark-era variant names are kept
   and mapped onto the new semantic bg/text pairs. */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-ai-bg text-ai',
  muted: 'bg-black/[0.05] text-muted',
};

/**
 * Single source of truth for reconciliation-flag badges. Token law: orange =
 * variance/review; red is reserved for tamper/offline/danger. The text label
 * ('Variance' vs 'Review'), not the color, differentiates the two flags.
 */
export const FLAG_BADGE_VARIANT: Record<ReconciliationFlag, BadgeVariant> = {
  ok: 'ok',
  review: 'warn',
  variance: 'warn',
};

export function Badge({
  variant = 'muted',
  children,
  className,
}: {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium tabular-nums',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
