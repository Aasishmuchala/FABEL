import { cn } from '@/lib/format';
import { Card } from './card';

export type StatTone = 'ok' | 'warn' | 'danger' | 'neutral';

const TONE_CLASSES: Record<StatTone, string> = {
  ok: 'text-teal',
  warn: 'text-amber',
  danger: 'text-red',
  neutral: 'text-muted',
};

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaTone = 'neutral',
  className,
}: {
  label: string;
  value: React.ReactNode;
  /** Small muted line under the numeral. */
  sub?: string;
  /** Short delta/context chip rendered beside the numeral, e.g. "+4% wow". */
  delta?: string;
  deltaTone?: StatTone;
  className?: string;
}) {
  return (
    <Card className={className}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-3xl font-bold tabular-nums text-text">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              TONE_CLASSES[deltaTone],
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </Card>
  );
}
