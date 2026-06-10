import { cn } from '@/lib/format';
import type { ReconciliationFlag } from '@/lib/types';

export type BadgeVariant = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  ok: 'bg-teal/12 text-teal',
  warn: 'bg-amber/12 text-amber',
  danger: 'bg-red/12 text-red',
  info: 'bg-purple/12 text-purple',
  muted: 'bg-white/8 text-muted',
};

/**
 * Single source of truth for reconciliation-flag badges. Token law: amber =
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
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
