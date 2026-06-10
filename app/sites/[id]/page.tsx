import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  DoorOpen,
  Film,
  Play,
  ShieldAlert,
  ShieldCheck,
  VideoOff,
} from 'lucide-react';
import {
  getBoq,
  getCameras,
  getClips,
  getDailyCounts,
  getLatestDailyCount,
  getLedger,
  getOrderedQty,
  getReconciliations,
  getSite,
  getStages,
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
import { InsightsCard } from '@/components/insights/insights-card';
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

  // Procurement summary: the open stage plus ordered % by BOQ value.
  const stages = getStages(id);
  const openStage = stages.find((s) => s.status === 'in-progress');
  let orderedPct: number | null = null;
  if (openStage) {
    let budget = 0;
    let orderedValue = 0;
    for (const item of getBoq(id, openStage.id)) {
      budget += item.qty * item.ratePerUnit;
      orderedValue +=
        Math.min(getOrderedQty(item.id), item.qty) * item.ratePerUnit;
    }
    orderedPct = budget > 0 ? Math.round((orderedValue / budget) * 100) : 0;
  }

  // Compact live preview: gate cams first, then the solar mast — max three.
  const previewCams = [
    ...gateCams,
    ...(solarCam ? [solarCam] : []),
    ...cameras.filter((c) => c.kind === 'zone'),
  ].slice(0, 3);

  return (
    <div className="space-y-10">
      {/* page header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">
            {site.city} · {site.contractor}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
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
          <p className="text-[13px] font-medium text-muted">
            Detected savings this month
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-ok">
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
              <p className="text-[13px] font-medium text-muted">
                Verified on site now
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight tabular-nums text-text">
                  {formatRange(todayCount.verifiedMin, todayCount.verifiedMax)}
                </span>
                <span className="text-[13px] font-medium text-ok">workers</span>
              </div>
              <RangeBar
                min={todayCount.verifiedMin}
                max={todayCount.verifiedMax}
                showLabels={false}
                className="mt-3"
              />
              <p className="mt-2 text-[13px] text-muted">
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

      {/* site intelligence */}
      <section>
        <InsightsCard siteId={id} />
      </section>

      {/* live view */}
      <section className="space-y-4">
        <SectionHeader
          title="Live view"
          label="On-demand video"
          description="Connects to the site over WebRTC — video streams only while you watch."
          actions={
            cameras.length > 0 ? (
              <Link
                href={`/sites/${id}/live`}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <Play size={16} strokeWidth={1.75} aria-hidden />
                Open live view
              </Link>
            ) : null
          }
        />
        {cameras.length === 0 ? (
          <EmptyState
            icon={VideoOff}
            title="No cameras connected"
            description="Live tiles appear here once cameras are wired into the site's edge AI box."
          />
        ) : (
          <Link
            href={`/sites/${id}/live`}
            aria-label={`Open live view for ${site.name}`}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {previewCams.map((cam) => (
              <LiveTile
                key={cam.id}
                label={cam.kind === 'solar' ? 'Site overview — solar mast' : cam.name}
                status={cam.status}
              />
            ))}
          </Link>
        )}
      </section>

      {/* procurement summary */}
      <section className="space-y-4">
        <SectionHeader
          title="Procurement"
          label="Quality-gated materials"
          description="Materials unlock stage by stage as quality gates pass."
        />
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 rounded-[18px] border border-hairline bg-surface p-6 shadow-card">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Stage in progress</p>
            <p className="mt-1 truncate text-lg font-semibold tracking-tight text-text">
              {openStage ? openStage.name : 'No stage open'}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {openStage
                ? `Stage ${openStage.order} of ${stages.length} · quality gate open`
                : 'All gates closed for materials'}
            </p>
          </div>
          {orderedPct !== null ? (
            <div>
              <p className="text-[13px] font-medium text-muted">
                Materials ordered
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums text-text">
                {orderedPct}%
              </p>
              <div className="mt-1.5 h-1.5 w-36 rounded-full bg-black/[0.06]">
                <div
                  className="h-1.5 rounded-full bg-chart-green"
                  style={{ width: `${orderedPct}%` }}
                />
              </div>
            </div>
          ) : null}
          <Link
            href={`/procurement?site=${site.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/[0.05] px-5 text-[14px] font-medium text-text transition-colors hover:bg-black/[0.09]"
          >
            Open procurement
            <ArrowRight size={15} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
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
          <div className="flex items-start gap-3 rounded-[18px] border border-danger/20 bg-danger-bg p-4">
            <ShieldAlert
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-danger"
              aria-hidden
            />
            <div>
              <p className="text-[13px] font-medium text-danger">
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
