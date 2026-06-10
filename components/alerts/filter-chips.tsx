import Link from 'next/link';
import { cn } from '@/lib/format';

export type AlertFilter = 'all' | 'open' | 'resolved';

const ITEMS: Array<{ key: AlertFilter; label: string; href: string }> = [
  { key: 'all', label: 'All', href: '/alerts' },
  { key: 'open', label: 'Open', href: '/alerts?filter=open' },
  { key: 'resolved', label: 'Resolved', href: '/alerts?filter=resolved' },
];

export function FilterChips({
  active,
  counts,
}: {
  active: AlertFilter;
  counts: Record<AlertFilter, number>;
}) {
  return (
    <div className="flex items-center gap-2">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              isActive
                ? 'border-teal/40 bg-teal/12 text-teal'
                : 'border-line text-muted hover:border-white/15 hover:text-text',
            )}
          >
            {item.label}
            <span className="tabular-nums">{counts[item.key]}</span>
          </Link>
        );
      })}
    </div>
  );
}
