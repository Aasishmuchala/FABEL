import { ShieldAlert } from 'lucide-react';
import { cn, formatDateShort } from '@/lib/format';
import { HashChip } from '@/components/ui/hash-chip';
import type { LedgerEntry } from '@/lib/types';

function isTamperEntry(entry: LedgerEntry): boolean {
  return entry.summary.includes('tamper');
}

/**
 * Horizontal scroll strip of hash-chained ledger entries. Tamper-day entries
 * are tinted red; the chips read oldest → newest, left to right.
 */
export function LedgerStrip({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-2">
        {entries.map((entry) => {
          const tampered = isTamperEntry(entry);
          return (
            <div
              key={entry.date}
              className={cn(
                'flex flex-col gap-1.5 rounded-xl border px-3 py-2.5',
                tampered
                  ? 'border-danger/30 bg-danger-bg'
                  : 'border-hairline bg-surface',
              )}
            >
              <span
                className={cn(
                  'flex items-center gap-1 text-[12px] font-medium',
                  tampered ? 'text-danger' : 'text-muted',
                )}
              >
                {tampered ? (
                  <ShieldAlert size={12} strokeWidth={1.75} aria-hidden />
                ) : null}
                {formatDateShort(entry.date)}
              </span>
              <HashChip hash={entry.hash} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
