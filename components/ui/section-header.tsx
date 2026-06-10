import { cn } from '@/lib/format';

export function SectionHeader({
  title,
  label,
  description,
  actions,
  className,
}: {
  title: string;
  /** Small sentence-case label rendered above the title. */
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
          <p className="text-[13px] font-medium text-muted">{label}</p>
        ) : null}
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-text">
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
