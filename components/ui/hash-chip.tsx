import { Link2 } from 'lucide-react';
import { cn } from '@/lib/format';

/** Monospace truncated ledger hash with a chain-link icon. */
export function HashChip({
  hash,
  className,
}: {
  hash: string;
  className?: string;
}) {
  const display = hash.length > 10 ? `${hash.slice(0, 10)}…` : hash;
  return (
    <span
      title={hash}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted',
        className,
      )}
    >
      <Link2 size={12} className="shrink-0 text-muted" aria-hidden />
      {display}
    </span>
  );
}
