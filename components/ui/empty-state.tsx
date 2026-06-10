import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[18px] border border-dashed border-hairline bg-white/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <Icon size={20} strokeWidth={1.75} className="text-muted" aria-hidden />
      ) : null}
      <p className="mt-3 text-sm font-medium text-text">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
