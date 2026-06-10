import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { cn, formatDateShort } from '@/lib/format';
import type { Stage } from '@/lib/types';

function statusLine(stage: Stage, prev: Stage | undefined): string {
  if (stage.status === 'verified') {
    return stage.verifiedOn
      ? `Verified ${formatDateShort(stage.verifiedOn)}`
      : 'Verified';
  }
  if (stage.status === 'in-progress') {
    return 'Quality gate open — materials unlocked';
  }
  if (stage.gateNote) return stage.gateNote;
  return prev
    ? `Blocked by quality gate — verify '${prev.name}' first`
    : 'Blocked by quality gate';
}

/** Vertical build-order ladder; each stage links to ?stage= so the selection is shareable. */
export function StageLadder({
  stages,
  selectedId,
  siteId,
}: {
  stages: Stage[];
  selectedId: string;
  siteId: string;
}) {
  return (
    <ol className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card">
      {stages.map((stage, index) => {
        const selected = stage.id === selectedId;
        const prev = stages.find((s) => s.order === stage.order - 1);
        return (
          <li key={stage.id}>
            <Link
              href={`/procurement?site=${siteId}&stage=${stage.id}`}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex items-start gap-3 border-l-2 px-5 py-4 transition-colors',
                index > 0 && 'border-t border-t-hairline',
                selected
                  ? 'border-l-accent bg-black/[0.03]'
                  : 'border-l-transparent hover:bg-black/[0.02]',
              )}
            >
              {stage.status === 'verified' ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok-bg text-ok">
                  <Check size={13} strokeWidth={2} aria-hidden />
                </span>
              ) : stage.status === 'in-progress' ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                </span>
              ) : (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-muted">
                  <Lock size={12} strokeWidth={1.75} aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    'text-sm font-medium',
                    stage.status === 'locked' ? 'text-muted' : 'text-text',
                  )}
                >
                  <span className="tabular-nums">{stage.order}.</span>{' '}
                  {stage.name}
                </p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {statusLine(stage, prev)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
