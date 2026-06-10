import { cn, formatRange } from '@/lib/format';

function clampPct(pct: number): number {
  return Math.max(0, Math.min(100, pct));
}

/**
 * Horizontal track with a green verified band from verifiedMin to verifiedMax
 * and a thin dark marker at the billed value (when provided).
 */
export function RangeBar({
  min,
  max,
  billed,
  domainMax,
  showLabels = true,
  className,
}: {
  min: number;
  max: number;
  /** Billed labour-days for the same window — rendered as a thin dark marker. */
  billed?: number;
  /** Override the track's right edge; defaults to 115% of the largest value. */
  domainMax?: number;
  showLabels?: boolean;
  className?: string;
}) {
  const domain = Math.max(1, domainMax ?? Math.max(max, billed ?? 0) * 1.15);
  const minPct = clampPct((min / domain) * 100);
  const maxPct = clampPct((max / domain) * 100);
  const billedPct = billed !== undefined ? clampPct((billed / domain) * 100) : null;

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-1.5 w-full rounded-full bg-black/[0.06]">
        <div
          className="absolute inset-y-0 rounded-full bg-chart-green"
          style={{ left: `${minPct}%`, width: `${Math.max(maxPct - minPct, 1.5)}%` }}
        />
        {billedPct !== null ? (
          <div
            className="absolute -inset-y-1 w-0.5 rounded-full bg-text"
            style={{ left: `${billedPct}%` }}
          />
        ) : null}
      </div>
      {showLabels ? (
        <div className="mt-1.5 flex items-baseline justify-between text-[12px] tabular-nums">
          <span className="font-medium text-ok">
            {formatRange(min, max)} verified
          </span>
          {billed !== undefined ? (
            <span className="font-medium text-text">{billed} billed</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
