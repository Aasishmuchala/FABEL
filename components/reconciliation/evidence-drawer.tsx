'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  FileSearch,
  Film,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Confidence, EvidenceClip, ReconciliationFlag } from '@/lib/types';
import { Badge, FLAG_BADGE_VARIANT } from '@/components/ui/badge';
import { HashChip } from '@/components/ui/hash-chip';
import { RangeBar } from '@/components/ui/range-bar';
import {
  formatDateShort,
  formatInr,
  formatRange,
  formatVariancePct,
} from '@/lib/format';

export interface EvidenceDay {
  date: string;
  verifiedMin: number;
  verifiedMax: number;
  confidence: Confidence;
}

export interface EvidenceLedgerEntry {
  date: string;
  hash: string;
  prevHash: string;
}

const FLAG_LABEL: Record<ReconciliationFlag, string> = {
  ok: 'Within tolerance',
  review: 'Needs review',
  variance: 'Variance flagged',
};

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function EvidenceDrawer({
  billId,
  siteName,
  weekStart,
  billedLabourDays,
  verifiedMin,
  verifiedMax,
  variancePct,
  flag,
  savingsInr,
  days,
  clips,
  ledgerEntries,
  chainVerified,
}: {
  billId: string;
  siteName: string;
  weekStart: string;
  billedLabourDays: number;
  verifiedMin: number;
  verifiedMax: number;
  variancePct: number;
  flag: ReconciliationFlag;
  savingsInr: number;
  days: EvidenceDay[];
  clips: EvidenceClip[];
  ledgerEntries: EvidenceLedgerEntry[];
  chainVerified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Lock the page behind the modal drawer and move focus into it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-white/15 hover:text-text"
      >
        <FileSearch size={14} aria-hidden />
        Evidence
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close evidence drawer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Evidence pack — week of ${formatDateShort(weekStart)}`}
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col overflow-y-auto border-l border-line bg-surface"
          >
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Evidence pack
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold text-text">
                  Week of {formatDateShort(weekStart)}
                </h3>
                <p className="mt-0.5 text-xs text-muted">{siteName}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg border border-line bg-surface-2 p-1.5 text-muted transition-colors hover:border-white/15 hover:text-text"
              >
                <X size={16} aria-hidden />
              </button>
            </div>

            <div className="flex-1 space-y-6 px-5 py-5">
              {/* Reconciliation summary */}
              <section>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                    Reconciliation
                  </p>
                  <Badge variant={FLAG_BADGE_VARIANT[flag]}>
                    {formatVariancePct(variancePct)} · {FLAG_LABEL[flag]}
                  </Badge>
                </div>
                <div className="mt-3 rounded-xl border border-line bg-surface-2 p-4">
                  <RangeBar
                    min={verifiedMin}
                    max={verifiedMax}
                    billed={billedLabourDays}
                  />
                  {savingsInr > 0 ? (
                    <p className="mt-2 text-xs text-teal">
                      {formatInr(savingsInr)} detected savings this week
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted">
                      No savings flagged for this week
                    </p>
                  )}
                </div>
              </section>

              {/* Daily verified ranges */}
              <section>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Daily verified ranges
                </p>
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface-2">
                  {days.length === 0 ? (
                    <li className="px-3 py-3 text-xs text-muted">
                      No verified counts recorded for this week.
                    </li>
                  ) : (
                    days.map((day) => (
                      <li
                        key={day.date}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <span className="w-14 shrink-0 text-xs tabular-nums text-muted">
                          {formatDateShort(day.date)}
                        </span>
                        <RangeBar
                          min={day.verifiedMin}
                          max={day.verifiedMax}
                          showLabels={false}
                          className="min-w-0 flex-1"
                        />
                        <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-teal">
                          {formatRange(day.verifiedMin, day.verifiedMax)}
                        </span>
                        {day.confidence === 'calibrating' ? (
                          <Badge variant="warn">Calibrating</Badge>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {/* Evidence clips */}
              <section>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Evidence clips
                </p>
                {clips.length === 0 ? (
                  <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-4 text-xs text-muted">
                    No clips pinned to this week.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {clips.map((clip) => (
                      <li
                        key={clip.id}
                        className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5"
                      >
                        <Film
                          size={16}
                          className="mt-0.5 shrink-0 text-purple"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-text">{clip.label}</p>
                          <p className="mt-0.5 text-xs tabular-nums text-muted">
                            {clip.cameraName} · {formatDateShort(clip.date)}{' '}
                            {clip.time} · {formatDuration(clip.durationSec)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Ledger entries */}
              <section>
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
                  Ledger entries
                </p>
                <div
                  className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                    chainVerified
                      ? 'bg-teal/12 text-teal'
                      : 'bg-red/12 text-red'
                  }`}
                >
                  {chainVerified ? (
                    <ShieldCheck size={16} aria-hidden />
                  ) : (
                    <ShieldAlert size={16} aria-hidden />
                  )}
                  {chainVerified
                    ? 'Chain verified — every hash recomputed from genesis matches.'
                    : 'Chain could not be verified — escalate before paying.'}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {ledgerEntries.length === 0 ? (
                    <li className="text-xs text-muted">
                      No ledger entries for this week.
                    </li>
                  ) : (
                    ledgerEntries.map((entry) => (
                      <li
                        key={entry.date}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="text-xs tabular-nums text-muted">
                          {formatDateShort(entry.date)}
                        </span>
                        <HashChip hash={entry.hash} />
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>

            <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-4">
              <a
                href={`/api/evidence/${billId}`}
                download
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-teal/40 bg-teal/12 px-4 py-2 text-sm font-semibold text-teal transition-colors hover:bg-teal/20"
              >
                <Download size={16} aria-hidden />
                Download evidence pack (JSON)
              </a>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
