import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { DailyCount, Site } from '@/lib/types';
import { cn, formatDateShort, formatInr, formatRange } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RangeBar } from '@/components/ui/range-bar';
import { Sparkline } from '@/components/ui/sparkline';

export interface SiteCardProps {
  site: Site;
  /** Today's verified count for the site — only when dated today. */
  todayCount?: DailyCount;
  /** Date (YYYY-MM-DD) of the most recent count when no count exists for today. */
  lastVerifiedDate?: string;
  /** Verified mid-point series for the last 8 reconciled weeks, oldest → newest. */
  verifiedSeries: number[];
  /** Billed labour-days for the same weeks, oldest → newest. */
  billedSeries: number[];
  /** Detected savings from reconciliations in the last 30 days. */
  monthSavingsInr: number;
  /** Count of unresolved alerts for the site. */
  openAlerts: number;
}

export function SiteCard({
  site,
  todayCount,
  lastVerifiedDate,
  verifiedSeries,
  billedSeries,
  monthSavingsInr,
  openAlerts,
}: SiteCardProps) {
  return (
    <Link href={`/sites/${site.id}`} className="block">
      <Card className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-semibold text-text">
              {site.name}
            </h3>
            <p className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-muted">
              {site.contractor} · {site.city}
            </p>
          </div>
          <Badge variant={site.status === 'calibrated' ? 'ok' : 'warn'}>
            {site.status === 'calibrated' ? 'Calibrated' : 'Calibrating'}
          </Badge>
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Verified today
          </p>
          {todayCount ? (
            <>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums text-text">
                {formatRange(todayCount.verifiedMin, todayCount.verifiedMax)}
                <span className="ml-2 text-xs font-medium normal-case text-muted">
                  labour-days
                </span>
              </p>
              <RangeBar
                min={todayCount.verifiedMin}
                max={todayCount.verifiedMax}
                showLabels={false}
                className="mt-2.5"
              />
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-2xl font-bold text-muted">—</p>
              <p className="mt-1 text-xs text-muted">
                {lastVerifiedDate
                  ? `No count yet today · last verified ${formatDateShort(lastVerifiedDate)}`
                  : 'No counts posted yet'}
              </p>
            </>
          )}
        </div>

        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Verified vs billed · 8 wk
          </p>
          {verifiedSeries.length >= 2 ? (
            <>
              <Sparkline
                series={verifiedSeries}
                series2={billedSeries}
                width={220}
                height={44}
                className="mt-2 w-full"
              />
              <div className="mt-1.5 flex items-center gap-x-4 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full bg-teal" aria-hidden />
                  Verified
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-4 border-t-2 border-dashed border-amber"
                    aria-hidden
                  />
                  Billed
                </span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Not enough reconciled weeks yet
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-1 items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
              Saved · 30 days
            </p>
            <p
              className={cn(
                'mt-0.5 text-sm font-semibold tabular-nums',
                monthSavingsInr > 0 ? 'text-teal' : 'text-muted',
              )}
            >
              {formatInr(monthSavingsInr)}
            </p>
          </div>
          {openAlerts > 0 ? (
            <Badge variant="danger">
              <TriangleAlert size={12} aria-hidden />
              {openAlerts} open {openAlerts === 1 ? 'alert' : 'alerts'}
            </Badge>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
