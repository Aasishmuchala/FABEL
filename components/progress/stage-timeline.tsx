import { AlertTriangle, Check, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateShort, relativeTime } from '@/lib/format';
import type { Stage } from '@/lib/types';
import { CaptureMethodChip } from './capture-methods';
import { GateChecklist } from './gate-checklist';

/**
 * Deviation labels live in the stage's gateNote as
 * "N open deviations — label one; label two". Strip the count prefix and
 * split on semicolons; fall back to the whole note if it has no em dash.
 */
function deviationLabels(stage: Stage): string[] {
  if (stage.openDeviations === 0 || !stage.gateNote) return [];
  const dash = stage.gateNote.indexOf('—');
  const body = dash >= 0 ? stage.gateNote.slice(dash + 1) : stage.gateNote;
  return body
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function StatusDisc({ status }: { status: Stage['status'] }) {
  if (status === 'verified') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok">
        <Check size={14} strokeWidth={2} aria-hidden />
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-muted">
      <Lock size={13} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/** Vertical record of all 14 lifecycle stages for one site. */
export function StageTimeline({ stages }: { stages: Stage[] }) {
  return (
    <ol className="space-y-3">
      {stages.map((stage) => {
        const prev = stages.find((s) => s.order === stage.order - 1);
        const inProgress = stage.status === 'in-progress';
        const locked = stage.status === 'locked';
        const deviations = deviationLabels(stage);
        const lockedNote = locked
          ? (stage.gateNote ??
            (prev
              ? `Unlocks when '${prev.name}' passes its quality gate`
              : 'Blocked by quality gate'))
          : undefined;

        return (
          <li
            key={stage.id}
            className={cn(
              'rounded-[18px] border border-hairline bg-surface p-5 shadow-card',
              inProgress && 'border-accent/30 ring-1 ring-accent/15',
              locked && 'opacity-60',
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div className="flex min-w-0 items-start gap-3">
                <StatusDisc status={stage.status} />
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-[15px] font-semibold tracking-tight',
                      locked ? 'text-muted' : 'text-text',
                    )}
                  >
                    <span className="tabular-nums text-muted">
                      {stage.order}.
                    </span>{' '}
                    {stage.name}
                  </p>
                  {stage.lastCaptureAt ? (
                    <p className="mt-0.5 text-[12px] text-muted">
                      Last capture {relativeTime(stage.lastCaptureAt)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {stage.openDeviations > 0 ? (
                  <Badge variant="danger">
                    <AlertTriangle size={12} strokeWidth={1.75} aria-hidden />
                    {stage.openDeviations}{' '}
                    {stage.openDeviations === 1 ? 'deviation' : 'deviations'}{' '}
                    open
                  </Badge>
                ) : null}
                {stage.status === 'verified' ? (
                  <Badge variant="ok">
                    <Check size={13} strokeWidth={2} aria-hidden />
                    {stage.verifiedOn
                      ? `Verified ${formatDateShort(stage.verifiedOn)}`
                      : 'Verified'}
                  </Badge>
                ) : inProgress ? (
                  <Badge variant="warn">
                    In progress · {stage.progressPct}%
                  </Badge>
                ) : (
                  <Badge variant="muted">
                    <Lock size={12} strokeWidth={1.75} aria-hidden />
                    Locked
                  </Badge>
                )}
              </div>
            </div>

            {inProgress ? (
              <div className="mt-3 h-1.5 w-full max-w-44 rounded-full bg-black/[0.06]">
                <div
                  className="h-1.5 rounded-full bg-accent"
                  style={{ width: `${stage.progressPct}%` }}
                />
              </div>
            ) : null}

            {lockedNote ? (
              <p className="mt-2.5 text-[13px] text-muted">{lockedNote}</p>
            ) : null}

            {stage.status === 'verified' && stage.gateNote ? (
              <p className="mt-2.5 text-[13px] text-muted">{stage.gateNote}</p>
            ) : null}

            {deviations.length > 0 ? (
              <ul className="mt-2.5 space-y-1">
                {deviations.map((label) => (
                  <li
                    key={label}
                    className="flex items-start gap-2 text-[13px] text-danger"
                  >
                    <AlertTriangle
                      size={14}
                      strokeWidth={1.75}
                      className="mt-0.5 shrink-0"
                      aria-hidden
                    />
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {stage.captureMethods.map((method) => (
                <CaptureMethodChip key={method} method={method} />
              ))}
            </div>

            {stage.checklist.length > 0 ? (
              <GateChecklist items={stage.checklist} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
