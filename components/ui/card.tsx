import { cn } from '@/lib/format';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-white/15',
        className,
      )}
    >
      {children}
    </div>
  );
}
