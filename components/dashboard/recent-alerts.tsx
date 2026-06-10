import Link from 'next/link';
import {
  Bell,
  CameraOff,
  ShieldAlert,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { AlertType, SiteAlert } from '@/lib/types';
import { cn, relativeTime } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

const TYPE_ICONS: Record<AlertType, LucideIcon> = {
  offline: CameraOff,
  tamper: ShieldAlert,
  degraded: TriangleAlert,
  power: Zap,
};

const TYPE_LABELS: Record<AlertType, string> = {
  offline: 'Camera offline',
  tamper: 'Tamper event',
  degraded: 'Feed degraded',
  power: 'Power loss',
};

/** Red for tamper/offline, amber for degraded/power — muted once resolved. */
function iconTone(alert: SiteAlert): string {
  if (alert.resolvedIso) return 'text-muted';
  return alert.type === 'tamper' || alert.type === 'offline'
    ? 'text-red'
    : 'text-amber';
}

function statusVariant(alert: SiteAlert): BadgeVariant {
  if (alert.resolvedIso) return 'muted';
  return alert.type === 'tamper' || alert.type === 'offline'
    ? 'danger'
    : 'warn';
}

export function RecentAlerts({
  items,
  siteNames,
}: {
  /** Alerts to list — open first, then newest. */
  items: SiteAlert[];
  /** siteId → display name. */
  siteNames: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No alerts"
        description="All cameras healthy. Offline and tamper events will appear here and on the ledger."
      />
    );
  }

  return (
    <Card className="py-2">
      <ul className="divide-y divide-line">
        {items.map((alert) => {
          const Icon = TYPE_ICONS[alert.type];
          return (
            <li key={alert.id}>
              <Link
                href="/alerts"
                className="flex items-center gap-3 py-3.5"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5',
                    iconTone(alert),
                  )}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">
                    {siteNames[alert.siteId] ?? alert.siteId}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {TYPE_LABELS[alert.type]} · {relativeTime(alert.openedIso)}
                  </p>
                </div>
                <Badge variant={statusVariant(alert)} className="shrink-0">
                  {alert.resolvedIso ? 'Resolved' : 'Open'}
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
