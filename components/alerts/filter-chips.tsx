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
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
              isActive
                ? 'bg-text text-white'
                : 'bg-black/[0.05] text-muted hover:bg-black/[0.09] hover:text-text',
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
