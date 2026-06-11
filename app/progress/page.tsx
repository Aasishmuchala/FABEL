import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Inbox, Lock } from 'lucide-react';
import { getSites, getStageProgress, getStages } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { cn } from '@/lib/format';
import { CaptureMethodStrip } from '@/components/progress/capture-methods';
import { StageTimeline } from '@/components/progress/stage-timeline';
import type { Stage } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Progress',
  description:
    'Stage-by-stage record of the build — capture methods, gate checklists and open deviations.',
};

function segmentTitle(stage: Stage): string {
  const status =
    stage.status === 'verified'
      ? 'Verified'
      : stage.status === 'in-progress'
        ? `In progress · ${stage.progressPct}%`
        : 'Locked';
  return `Stage ${stage.order} — ${stage.name} · ${status}`;
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site: siteParam } = await searchParams;
  const sites = getSites();
  const selectedSite = sites.find((s) => s.id === siteParam) ?? sites[0];

  if (!selectedSite) {
    return (
      <EmptyState
        icon={Inbox}
        title="No sites connected"
        description="Connect a site to start recording its build stages."
      />
    );
  }

  const stages = getStages(selectedSite.id);

  if (stages.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No stages defined"
        description="This site has no build stages yet."
      />
    );
  }

  const progress = getStageProgress(selectedSite.id);

  const trackSummary =
    `Build progress for ${selectedSite.name}: ` +
    `${progress.completed} of ${progress.total} stages verified` +
    (progress.current.status === 'in-progress'
      ? `, stage ${progress.current.order} (${progress.current.name}) in progress at ${progress.current.progressPct}%`
      : '') +
    ` — ${progress.overallPct}% overall.`;

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <p className="text-[13px] font-medium text-muted">
          Stage-by-stage record of the build
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
          Progress
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every stage is captured, checked against its quality gate and only
          then verified.
        </p>
      </div>

      {/* Site switcher */}
      <div className="flex flex-wrap gap-2">
        {sites.map((site) => {
          const active = site.id === selectedSite.id;
          return (
            <Link
              key={site.id}
              href={`/progress?site=${site.id}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-text text-white'
                  : 'bg-black/[0.05] text-muted hover:bg-black/[0.09] hover:text-text',
              )}
            >
              {site.name}
            </Link>
          );
        })}
      </div>

      {/* Hero: current stage + overall completion + 14-segment track */}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-muted">Current stage</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-5xl font-semibold tracking-tight tabular-nums text-text">
                {progress.current.order}
              </span>
              <span className="text-xl font-medium text-muted">
                {`of ${progress.total}`}
              </span>
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold tracking-tight text-text">
              {progress.current.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[13px] font-medium text-muted">
              Overall completion
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums text-text">
              {progress.overallPct}%
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {`${progress.completed} of ${progress.total} quality gates passed`}
            </p>
          </div>
        </div>
        <div role="img" aria-label={trackSummary} className="mt-6 flex gap-1">
          {stages.map((stage) => (
            <div
              key={stage.id}
              title={segmentTitle(stage)}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]"
            >
              {stage.status === 'verified' ? (
                <div className="h-full w-full rounded-full bg-chart-green" />
              ) : stage.status === 'in-progress' ? (
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${stage.progressPct}%` }}
                />
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      {/* Capture methods */}
      <CaptureMethodStrip />

      {/* Stage timeline */}
      <section className="space-y-4">
        <SectionHeader
          label="Lifecycle"
          title="Stage timeline"
          description={`All ${progress.total} stages for ${selectedSite.name}, from site cleaning to handover.`}
        />
        <StageTimeline stages={stages} />
      </section>

      {/* Procurement cross-link */}
      <div className="flex items-start gap-3 rounded-[18px] border border-dashed border-hairline bg-white/60 px-5 py-4">
        <Lock
          size={16}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0 text-muted"
          aria-hidden
        />
        <p className="text-[13px] text-muted">
          {`A stage's quality gate must pass before the next stage's materials unlock — `}
          <Link
            href={`/procurement?site=${selectedSite.id}`}
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            see Procurement
            <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
