'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Scale, Bell } from 'lucide-react';
import { cn } from '@/lib/format';

const NAV_ITEMS = [
  { href: '/', label: 'Portfolio', icon: Building2 },
  { href: '/reconciliation', label: 'Reconciliation', icon: Scale },
  { href: '/alerts', label: 'Alerts', icon: Bell },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/sites');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2">
      <span className="font-display text-xl font-bold tracking-tight text-text">
        Haazri
      </span>
      <span
        aria-hidden
        className="mt-0.5 inline-block h-2 w-2 rounded-full bg-teal shadow-none"
      />
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Wordmark />
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface-2 text-text'
                    : 'text-muted hover:bg-surface-2/60 hover:text-text',
                )}
              >
                <Icon size={17} className={cn(active && 'text-teal')} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
            Pilot build
          </span>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                active ? 'text-teal' : 'text-muted',
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
