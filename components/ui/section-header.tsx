import { cn } from '@/lib/format';

export function SectionHeader({
  title,
  label,
  description,
  actions,
  className,
}: {
  title: string;
  /** Microlabel rendered above the title. */
  label?: string;
  description?: string;
  /** Right-aligned contextual actions. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-3',
        className,
      )}
    >
      <div>
        {label ? (
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {label}
          </p>
        ) : null}
        <h2 className="mt-1 font-display text-lg font-semibold text-text">
          {title}
        </h2>
        {description ? (
          <p className="mt-0.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
