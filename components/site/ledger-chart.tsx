import { cn, formatDateShort, formatRange } from '@/lib/format';

export interface LedgerChartDay {
  date: string;
  min: number;
  max: number;
  /** Billed labour-days attributed to this day (weekly bill ÷ 7), when a reconciliation exists. */
  billed?: number;
}

const W = 920;
const H = 250;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 18;
const PAD_B = 28;

function fmt(v: number): number {
  return Number(v.toFixed(2));
}

/**
 * Pure-SVG daily ledger chart on a white card: chart-green translucent band
 * between verifiedMin and verifiedMax, a chart-green mid line with dots, and
 * a dashed chart-orange step-line overlay of billed labour-days per day where
 * reconciliations exist. Gridlines are near-invisible per the light system.
 */
export function LedgerChart({
  days,
  ariaLabel,
  className,
}: {
  days: LedgerChartDay[];
  ariaLabel: string;
  className?: string;
}) {
  if (days.length < 2) {
    return null;
  }

  const n = days.length;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const rawMax = Math.max(...days.map((d) => Math.max(d.max, d.billed ?? 0)));
  const yMax = Math.max(10, Math.ceil((rawMax * 1.15) / 5) * 5);

  const x = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

  // Verified band: along the max edge forward, back along the min edge.
  const bandPath =
    days
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${fmt(x(i))},${fmt(y(d.max))}`)
      .join(' ') +
    ' ' +
    [...days]
      .map((d, i) => ({ d, i }))
      .reverse()
      .map(({ d, i }) => `L${fmt(x(i))},${fmt(y(d.min))}`)
      .join(' ') +
    ' Z';

  const midOf = (d: LedgerChartDay) => (d.min + d.max) / 2;
  const midPoints = days
    .map((d, i) => `${fmt(x(i))},${fmt(y(midOf(d)))}`)
    .join(' ');

  // Billed step-line: one horizontal segment per day slot, vertical joins inside runs.
  const half = innerW / (n - 1) / 2;
  let billedPath = '';
  for (let i = 0; i < n; i++) {
    const v = days[i].billed;
    if (v === undefined) continue;
    const x0 = Math.max(PAD_L, x(i) - half);
    const x1 = Math.min(PAD_L + innerW, x(i) + half);
    const prev = i > 0 ? days[i - 1].billed : undefined;
    billedPath +=
      prev === undefined
        ? `M${fmt(x0)},${fmt(y(v))} `
        : `L${fmt(x0)},${fmt(y(v))} `;
    billedPath += `L${fmt(x1)},${fmt(y(v))} `;
  }

  // Horizontal gridlines at quarter steps of the y domain.
  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(t * yMax));

  // X-axis date ticks: roughly six, always including the last day.
  const step = Math.max(1, Math.round((n - 1) / 5));
  const tickIndices: number[] = [];
  for (let i = 0; i < n - 1; i += step) {
    if (n - 1 - i >= step * 0.6) tickIndices.push(i);
  }
  tickIndices.push(n - 1);

  const last = days[n - 1];

  return (
    <div className={cn('w-full', className)}>
      {/* min-width + horizontal scroll keeps axis text legible on mobile
          instead of letting the whole viewBox shrink below readability. */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[700px]"
          role="img"
          aria-label={ariaLabel}
        >
        <title>{ariaLabel}</title>

        {/* gridlines + y labels */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD_L}
              x2={PAD_L + innerW}
              y1={fmt(y(v))}
              y2={fmt(y(v))}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={fmt(y(v))}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-muted)"
            >
              {v}
            </text>
          </g>
        ))}

        {/* x date ticks */}
        {tickIndices.map((i) => (
          <text
            key={days[i].date}
            x={fmt(x(i))}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize={11}
            fill="var(--color-muted)"
          >
            {formatDateShort(days[i].date)}
          </text>
        ))}

        {/* verified min–max band */}
        <path d={bandPath} fill="var(--color-chart-green)" fillOpacity={0.16} />

        {/* mid line */}
        <polyline
          points={midPoints}
          fill="none"
          stroke="var(--color-chart-green)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* mid dots */}
        {days.map((d, i) => (
          <circle
            key={d.date}
            cx={fmt(x(i))}
            cy={fmt(y(midOf(d)))}
            r={1.4}
            fill="var(--color-chart-green)"
            fillOpacity={0.55}
          />
        ))}

        {/* billed step overlay */}
        {billedPath ? (
          <path
            d={billedPath.trim()}
            fill="none"
            stroke="var(--color-chart-orange)"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            strokeLinejoin="round"
          />
        ) : null}

        {/* last-day highlight */}
        <line
          x1={fmt(x(n - 1))}
          x2={fmt(x(n - 1))}
          y1={PAD_T}
          y2={PAD_T + innerH}
          stroke="var(--color-line-bright)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <circle
          cx={fmt(x(n - 1))}
          cy={fmt(y(midOf(last)))}
          r={4}
          fill="var(--color-chart-green)"
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
        <text
          x={fmt(x(n - 1)) - 8}
          y={Math.max(PAD_T + 8, fmt(y(last.max)) - 10)}
          textAnchor="end"
          fontSize={13}
          fontWeight={600}
          fill="var(--color-ok)"
        >
          {formatRange(last.min, last.max)} today
        </text>
        </svg>
      </div>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-muted">
        <span className="inline-flex items-center gap-2">
          <span
            className="h-2.5 w-5 rounded-sm bg-chart-green/20 ring-1 ring-inset ring-chart-green/40"
            aria-hidden
          />
          Verified range (min–max)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-chart-green" aria-hidden />
          Mid estimate
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="w-5 border-t-2 border-dashed border-chart-orange"
            aria-hidden
          />
          Billed per day (weekly bill ÷ 7)
        </span>
      </div>
    </div>
  );
}
