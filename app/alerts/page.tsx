import type { Metadata } from 'next';
import { BellOff, ShieldCheck } from 'lucide-react';
import { getAlerts, getCameras, getSites } from '@/lib/store';
import type { SiteAlert } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertRow } from '@/components/alerts/alert-row';
import { FilterChips, type AlertFilter } from '@/components/alerts/filter-chips';
import { formatDateShort } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Alerts',
  description:
    'Tamper, offline and power events — every alert doubles as hash-chained ledger evidence.',
};

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(date: string): string {
  const now = new Date();
  const today = localDateStr(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = localDateStr(y);
  if (date === today) return `Today · ${formatDateShort(date)}`;
  if (date === yesterday) return `Yesterday · ${formatDateShort(date)}`;
  return formatDateShort(date);
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawFilter = Array.isArray(sp.filter) ? sp.filter[0] : sp.filter;
  const filter: AlertFilter =
    rawFilter === 'open' ? 'open' : rawFilter === 'resolved' ? 'resolved' : 'all';

  const alerts = getAlerts();
  const sites = getSites();
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));
  const cameraNameById = new Map<string, string>();
  for (const site of sites) {
    for (const cam of getCameras(site.id)) {
      cameraNameById.set(cam.id, cam.name);
    }
  }

  const openCount = alerts.filter((a) => !a.resolvedIso).length;
  const counts: Record<AlertFilter, number> = {
    all: alerts.length,
    open: openCount,
    resolved: alerts.length - openCount,
  };

  const filtered = alerts
    .filter((a) =>
      filter === 'open'
        ? !a.resolvedIso
        : filter === 'resolved'
          ? Boolean(a.resolvedIso)
          : true,
    )
    .sort((a, b) => b.openedIso.localeCompare(a.openedIso));

  const groups = new Map<string, SiteAlert[]>();
  for (const alert of filtered) {
    const day = alert.openedIso.slice(0, 10);
    const bucket = groups.get(day);
    if (bucket) {
      bucket.push(alert);
    } else {
      groups.set(day, [alert]);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">
            Tamper, offline and power events — every alert is also a ledger
            entry
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
            Alerts
          </h1>
        </div>
        <Badge variant={openCount > 0 ? 'danger' : 'ok'}>
          {openCount} open
        </Badge>
      </div>

      <div className="flex items-start gap-3.5 rounded-[18px] border border-hairline bg-surface p-5 shadow-card">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ok-bg">
          <ShieldCheck size={18} strokeWidth={1.75} className="text-ok" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium text-text">Downtime is evidence</p>
          <p className="mt-0.5 text-sm text-muted">
            Camera downtime is itself written to the hash-chained ledger —
            no-footage windows are billed at builder-verified headcount per
            contract.
          </p>
        </div>
      </div>

      <FilterChips active={filter} counts={counts} />

      {groups.size === 0 ? (
        <EmptyState
          icon={BellOff}
          title={
            filter === 'open'
              ? 'No open alerts'
              : filter === 'resolved'
                ? 'No resolved alerts'
                : 'No alerts yet'
          }
          description={
            filter === 'open'
              ? 'Every camera is reporting. New tamper, offline or power events will appear here the moment they open.'
              : 'Alerts appear here as the edge boxes report tamper, offline, degraded or power events.'
          }
        />
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([date, dayAlerts]) => (
            <section key={date}>
              <p className="mb-2 text-[13px] font-medium text-muted">
                {dayLabel(date)}
              </p>
              <div className="divide-y divide-line overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card">
                {dayAlerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    siteName={siteNameById.get(alert.siteId) ?? alert.siteId}
                    cameraName={
                      alert.cameraId
                        ? cameraNameById.get(alert.cameraId)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
