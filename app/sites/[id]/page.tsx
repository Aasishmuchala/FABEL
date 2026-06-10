import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DoorOpen, Film, ShieldAlert, ShieldCheck, VideoOff } from 'lucide-react';
import {
  getCameras,
  getClips,
  getDailyCounts,
  getLatestDailyCount,
  getLedger,
  getReconciliations,
  getSite,
  mondayOf,
  verifyLedger,
} from '@/lib/store';
import { formatDateShort, formatInr, formatRange } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LiveTile } from '@/components/ui/live-tile';
import { RangeBar } from '@/components/ui/range-bar';
import { SectionHeader } from '@/components/ui/section-header';
import { StatCard } from '@/components/ui/stat-card';
import { CameraCard } from '@/components/site/camera-card';
import { ClipList } from '@/components/site/clip-list';
import { LedgerChart } from '@/components/site/ledger-chart';
import type { LedgerChartDay } from '@/components/site/ledger-chart';
import { LedgerStrip } from '@/components/site/ledger-strip';

export const dynamic = 'force-dynamic';

function dateStrDaysAgo(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const site = getSite(id);
  if (!site) {
    return { title: 'Site not found' };
  }
  return {
    title: site.name,
    description: `Verified labour ranges, cameras and hash-chained ledger for ${site.name}, ${site.city}.`,
  };
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = getSite(id);
  if (!site) notFound();

  const cameras = getCameras(id);
  const gateCams = cameras.filter((c) => c.kind === 'gate');
  const solarCam = cameras.find((c) => c.kind === 'solar');
  const camerasOnline = cameras.filter((c) => c.status === 'online').length;

  const counts = getDailyCounts(id);
  // Only a count dated today renders as "Verified on site now" — a stale
  // latest count must not masquerade as live verification.
  const latest = getLatestDailyCount(id);
  const todayStr = dateStrDaysAgo(0);
  const todayCount = latest?.date === todayStr ? latest : undefined;

  const reconciliations = getReconciliations(id);
  const cutoff = dateStrDaysAgo(30);
  const savings30 = reconciliations
    .filter((r) => r.weekStart >= cutoff)
    .reduce((s, r) => s + r.savingsInr, 0);

  const billedPerDay = new Map(
    reconciliations.map((r) => [r.weekStart, r.billedLabourDays / 7]),
  );
  const chartDays: LedgerChartDay[] = counts.map((c) => ({
    date: c.date,
    min: c.verifiedMin,
    max: c.verifiedMax,
    billed: billedPerDay.get(mondayOf(c.date)),
  }));

  const ledger = getLedger(id);
  const recentLedger = ledger.slice(-14);
  const chainStatus = verifyLedger(id);
  const tamperEntry = ledger.find((e) => e.summary.includes('tamper'));

  const clips = getClips(id);

  return (
    <div className="space-y-8">
      {/* page header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {site.city} · {site.contractor}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-text">
            {site.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {site.status === 'calibrated' ? (
              <Badge variant="ok">
                <ShieldCheck size={12} aria-hidden />
                Calibrated
              </Badge>
            ) : (
              <Badge variant="warn">Calibrating</Badge>
            )}
            <Badge variant={site.gateChannelled ? 'muted' : 'warn'}>
              <DoorOpen size={12} aria-hidden />
              {site.gateChannelled ? 'Gate channelled' : 'Gate not channelled'}
            </Badge>
            {site.tagline ? (
              <span className="text-xs text-muted">{site.tagline}</span>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            Detected savings this month
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums text-teal">
            {formatInr(savings30)}
          </p>
        </div>
      </header>

      {/* today */}
      <section className="space-y-4">
        <SectionHeader
          title="Today"
          label="Daily verification"
          description="Live ranges from the man-gate count — never point numbers."
        />
        {todayCount ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Verified on site now
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tabular-nums text-text">
                  {formatRange(todayCount.verifiedMin, todayCount.verifiedMax)}
                </span>
                <span className="text-xs font-medium text-teal">workers</span>
              </div>
              <RangeBar
                min={todayCount.verifiedMin}
                max={todayCount.verifiedMax}
                showLabels={false}
                className="mt-3"
              />
              <p className="mt-2 text-xs text-muted">
                {todayCount.confidence === 'calibrated'
                  ? 'Calibrated gate count'
                  : 'Calibrating — range still settling'}
              </p>
            </Card>
            <StatCard
              label="Gate movements"
              value={
                <>
                  {todayCount.gateEntries}
                  <span className="text-base font-semibold text-muted"> in</span>
                  <span className="text-muted"> / </span>
                  {todayCount.gateExits}
                  <span className="text-base font-semibold text-muted"> out</span>
                </>
              }
              sub="Entries and exits through the channelled man-gate"
            />
            <StatCard
              label="Peak occupancy"
              value={todayCount.peakOccupancy}
              sub={`${todayCount.samples} AI samples captured today`}
            />
          </div>
        ) : (
          <EmptyState
            title={latest ? 'No count yet today' : 'No counts yet'}
            description={
              latest
                ? `Last verified ${formatDateShort(latest.date)} — ${formatRange(latest.verifiedMin, latest.verifiedMax)} workers. Today's range appears once the edge box posts it.`
                : 'The edge box has not posted a verified count for this site yet.'
            }
          />
        )}
      </section>

      {/* live view */}
      <section className="space-y-4">
        <SectionHeader
          title="Live view"
          label="On-demand video"
          description="Connects to the site over WebRTC — video streams only while you watch."
        />
        {cameras.length === 0 ? (
          <EmptyState
            icon={VideoOff}
            title="No cameras connected"
            description="Live tiles appear here once cameras are wired into the site's edge AI box."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {gateCams.map((cam) => (
              <LiveTile key={cam.id} label={cam.name} status={cam.status} />
            ))}
            {solarCam ? (
              <LiveTile
                label="Site overview — solar mast"
                status={solarCam.status}
                className="sm:col-span-2"
              />
            ) : null}
          </div>
        )}
      </section>

      {/* 60-day ledger */}
      <section className="space-y-4">
        <SectionHeader
          title="60-day ledger"
          label="Verified vs billed"
          description={`Daily verified range against contractor billing · ${counts.length} days on record`}
        />
        <Card>
          {chartDays.length >= 2 ? (
            <LedgerChart
              days={chartDays}
              ariaLabel={`Daily verified labour range for ${site.name} over the last ${counts.length} days, with the contractor's billed labour-days per day overlaid where bills have been reconciled.`}
            />
          ) : (
            <EmptyState
              title="Not enough days yet"
              description="The chart appears once at least two verified days are on the ledger."
            />
          )}
        </Card>
      </section>

      {/* cameras */}
      <section className="space-y-4">
        <SectionHeader
          title="Cameras"
          label="Edge devices"
          description="Every unit wired into the site's edge AI box."
          actions={
            <Badge variant={camerasOnline === cameras.length ? 'ok' : 'warn'}>
              {camerasOnline}/{cameras.length} online
            </Badge>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      </section>

      {/* ledger integrity */}
      <section className="space-y-4">
        <SectionHeader
          title="Ledger integrity"
          label="Hash chain"
          description="Each day's record is hashed against the previous — edits break the chain."
          actions={
            chainStatus === 'verified' ? (
              <Badge variant="ok">
                <ShieldCheck size={12} aria-hidden />
                Chain verified
              </Badge>
            ) : chainStatus === 'failed' ? (
              <Badge variant="danger">
                <ShieldAlert size={12} aria-hidden />
                Chain broken
              </Badge>
            ) : (
              <Badge variant="muted">No ledger entries yet</Badge>
            )
          }
        />
        <LedgerStrip entries={recentLedger} />
        {tamperEntry ? (
          <div className="flex items-start gap-3 rounded-xl border border-red/30 bg-red/5 p-4">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-red" aria-hidden />
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-red">
                Tamper event on ledger
              </p>
              <p className="mt-1 text-sm text-text">{tamperEntry.summary}</p>
            </div>
          </div>
        ) : null}
      </section>

      {/* evidence clips */}
      <section className="space-y-4">
        <SectionHeader
          title="Evidence clips"
          label="Saved moments"
          description="Short clips the edge AI bookmarked as verification evidence."
        />
        {clips.length > 0 ? (
          <ClipList clips={clips} />
        ) : (
          <EmptyState
            icon={Film}
            title="No clips yet"
            description="Evidence clips appear here as the edge AI bookmarks notable gate activity."
          />
        )}
      </section>
    </div>
  );
}
