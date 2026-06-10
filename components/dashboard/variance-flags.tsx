import Link from 'next/link';
import { Scale } from 'lucide-react';
import type { Reconciliation } from '@/lib/types';
import { formatDateShort, formatRange, formatVariancePct } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge, FLAG_BADGE_VARIANT } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export function VarianceFlags({
  items,
  siteNames,
}: {
  /** Flagged reconciliations (review/variance), newest first. */
  items: Reconciliation[];
  /** siteId → display name. */
  siteNames: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Scale}
        title="No variance flags"
        description="All recent contractor bills reconcile within tolerance of the camera-verified range."
      />
    );
  }

  return (
    <Card className="py-2">
      <ul className="divide-y divide-line">
        {items.map((r) => (
          <li key={r.billId}>
            <Link
              href={`/reconciliation?site=${r.siteId}`}
              className="flex items-center justify-between gap-3 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">
                  {siteNames[r.siteId] ?? r.siteId}
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-muted">
                  Wk of {formatDateShort(r.weekStart)} · {r.billedLabourDays}{' '}
                  billed vs {formatRange(r.verifiedMin, r.verifiedMax)} verified
                </p>
              </div>
              <Badge variant={FLAG_BADGE_VARIANT[r.flag]} className="shrink-0">
                {r.flag === 'variance' ? 'Variance' : 'Review'} ·{' '}
                {formatVariancePct(r.variancePct)}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
