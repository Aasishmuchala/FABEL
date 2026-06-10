'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Package, Scale, Bell } from 'lucide-react';
import { cn } from '@/lib/format';

const NAV_ITEMS = [
  { href: '/', label: 'Portfolio', icon: Building2 },
  { href: '/procurement', label: 'Procurement', icon: Package },
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
    <Link href="/" className="flex items-center gap-2">
      <span className="text-[17px] font-semibold tracking-tight text-text">
        Haazri
      </span>
      <span
        aria-hidden
        className="mt-0.5 inline-block h-2 w-2 rounded-full bg-chart-green"
      />
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Frosted top bar */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center justify-between px-6">
          <Wordmark />
          <nav className="hidden items-center gap-7 sm:flex">
            {NAV_ITEMS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'text-[13px] font-medium transition-colors',
                    active ? 'text-text' : 'text-muted hover:text-text',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Frosted mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors',
                active ? 'text-accent' : 'text-muted',
              )}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="max-w-full truncate whitespace-nowrap px-1">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
