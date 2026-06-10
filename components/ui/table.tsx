import { cn } from '@/lib/format';

type Align = 'left' | 'right';

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  );
}

export function THead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <thead className={className}>{children}</thead>;
}

export function TBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tbody className={className}>{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <tr className={cn('transition-colors hover:bg-black/[0.02]', className)}>
      {children}
    </tr>
  );
}

export function TH({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-[12px] font-medium text-muted',
        align === 'right' && 'text-right',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  align = 'left',
  className,
}: {
  children?: React.ReactNode;
  align?: Align;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'border-t border-hairline px-3 py-3 align-middle',
        align === 'right' && 'text-right tabular-nums',
        className,
      )}
    >
      {children}
    </td>
  );
}
