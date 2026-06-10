import { cn } from '@/lib/format';
import { Card } from './card';

export type StatTone = 'ok' | 'warn' | 'danger' | 'neutral';

const TONE_CLASSES: Record<StatTone, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
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
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-text">
          {value}
        </span>
        {delta ? (
          <span
            className={cn(
              'text-[13px] font-medium tabular-nums',
              TONE_CLASSES[deltaTone],
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      {sub ? <p className="mt-1 text-[13px] text-muted">{sub}</p> : null}
    </Card>
  );
}
