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
        'rounded-[18px] border border-hairline bg-surface p-6 shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
