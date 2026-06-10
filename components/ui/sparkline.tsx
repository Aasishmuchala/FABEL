import { cn } from '@/lib/format';

function toPoints(
  series: number[],
  lo: number,
  hi: number,
  width: number,
  height: number,
  padding: number,
): string {
  const span = hi - lo || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const step = series.length > 1 ? innerW / (series.length - 1) : 0;
  return series
    .map((v, i) => {
      const x = padding + i * step;
      const y = padding + innerH - ((v - lo) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/**
 * Pure-SVG sparkline. Primary series in teal (with a faint area fill);
 * optional second series (e.g. billed overlay) as a dashed amber line.
 */
export function Sparkline({
  series,
  series2,
  width = 140,
  height = 40,
  className,
}: {
  series: number[];
  /** Optional overlay series (e.g. billed) — dashed amber. */
  series2?: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const all = series2 ? [...series, ...series2] : series;
  if (series.length < 2 || all.length === 0) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={className}
        aria-hidden
      />
    );
  }
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const padding = 2;
  const points = toPoints(series, lo, hi, width, height, padding);
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label="Trend sparkline"
    >
      <polygon points={areaPoints} fill="var(--color-teal)" opacity={0.07} />
      {series2 && series2.length > 1 ? (
        <polyline
          points={toPoints(series2, lo, hi, width, height, padding)}
          fill="none"
          stroke="var(--color-amber)"
          strokeWidth={1.25}
          strokeDasharray="3 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
