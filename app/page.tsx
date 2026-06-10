import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  getAlerts,
  getDailyCounts,
  getLatestDailyCount,
  getPortfolioSummary,
  getReconciliations,
  getSites,
  mondayOf,
} from '@/lib/store';
import { formatInr, formatRange } from '@/lib/format';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/ui/section-header';
import { SiteCard, type SiteCardProps } from '@/components/dashboard/site-card';
import { VarianceFlags } from '@/components/dashboard/variance-flags';
import { RecentAlerts } from '@/components/dashboard/recent-alerts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  // Template in the root layout does not apply to the same segment's page.
  title: 'Portfolio · Haazri',
  description:
    'All sites at a glance — verified labour-day ranges, leakage detected, and camera health.',
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ViewAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-text"
    >
      View all
      <ArrowRight size={13} aria-hidden />
    </Link>
  );
}

export default function PortfolioPage() {
  const sites = getSites();
  const summary = getPortfolioSummary();

  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const today = toDateStr(now);
  const weekStart = mondayOf(today);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = toDateStr(cutoff);

  const weekCounts = sites.flatMap((site) =>
    getDailyCounts(site.id).filter(
      (c) => c.date >= weekStart && c.date <= today,
    ),
  );
  const weekVerifiedMin = weekCounts.reduce((s, c) => s + c.verifiedMin, 0);
  const weekVerifiedMax = weekCounts.reduce((s, c) => s + c.verifiedMax, 0);

  const cards: SiteCardProps[] = sites.map((site) => {
    const recons = getReconciliations(site.id); // newest week first
    const recent8 = recons.slice(0, 8).reverse(); // oldest → newest
    // Only a count dated today is "Verified today" — a stale latest count
    // (e.g. yesterday's) must not masquerade as live verification.
    const latestCount = getLatestDailyCount(site.id);
    const fresh = latestCount?.date === today;
    return {
      site,
      todayCount: fresh ? latestCount : undefined,
      lastVerifiedDate: !fresh ? latestCount?.date : undefined,
      verifiedSeries: recent8.map((r) => (r.verifiedMin + r.verifiedMax) / 2),
      billedSeries: recent8.map((r) => r.billedLabourDays),
      monthSavingsInr: recons
        .filter((r) => r.weekStart >= cutoffStr)
        .reduce((sum, r) => sum + r.savingsInr, 0),
      openAlerts: getAlerts(site.id).filter((a) => !a.resolvedIso).length,
    };
  });

  const siteNames = Object.fromEntries(sites.map((s) => [s.id, s.name]));
  const varianceFlags = getReconciliations()
    .filter((r) => r.flag !== 'ok')
    .slice(0, 5);
  const recentAlerts = getAlerts().slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            All sites · live ledger
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-text">
            Portfolio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              summary.camerasOnline === summary.camerasTotal ? 'ok' : 'warn'
            }
          >
            {summary.camerasOnline}/{summary.camerasTotal} cameras online
          </Badge>
          {summary.pendingBills > 0 ? (
            <Link href="/reconciliation">
              <Badge variant="warn">
                {summary.pendingBills}{' '}
                {summary.pendingBills === 1 ? 'bill' : 'bills'} pending
              </Badge>
            </Link>
          ) : null}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Verified this week"
          value={formatRange(weekVerifiedMin, weekVerifiedMax)}
          sub="Labour-days across all sites"
        />
        <StatCard
          label="Leakage detected · 30d"
          value={formatInr(summary.savingsLast30dInr)}
          sub="Billed vs camera-verified gap"
        />
        <StatCard
          label="Open alerts"
          value={summary.openAlerts}
          delta={summary.openAlerts > 0 ? 'needs attention' : undefined}
          deltaTone="danger"
          sub="Tamper and camera health events"
        />
        <StatCard
          label="Sites monitored"
          value={summary.totalSites}
          sub={`${summary.camerasOnline} of ${summary.camerasTotal} cameras online`}
        />
      </div>

      {/* Site cards */}
      <section>
        <SectionHeader
          label="Sites"
          title="Your sites today"
          description="Verified ranges from the man-gate, reconciled weekly against contractor bills."
          className="mb-4"
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <SiteCard key={card.site.id} {...card} />
          ))}
        </div>
      </section>

      {/* Variance flags + recent alerts */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
        <section>
          <SectionHeader
            label="Reconciliation"
            title="Latest variance flags"
            actions={<ViewAllLink href="/reconciliation" />}
            className="mb-4"
          />
          <VarianceFlags items={varianceFlags} siteNames={siteNames} />
        </section>
        <section>
          <SectionHeader
            label="Camera health"
            title="Recent alerts"
            actions={<ViewAllLink href="/alerts" />}
            className="mb-4"
          />
          <RecentAlerts items={recentAlerts} siteNames={siteNames} />
        </section>
      </div>
    </div>
  );
}
