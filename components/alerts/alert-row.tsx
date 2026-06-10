import Link from 'next/link';
import {
  CameraOff,
  CloudOff,
  ShieldAlert,
  ZapOff,
  type LucideIcon,
} from 'lucide-react';
import type { AlertType, SiteAlert } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn, relativeTime } from '@/lib/format';
import { ResolveButton } from './resolve-button';

const TYPE_META: Record<
  AlertType,
  { icon: LucideIcon; label: string; tint: string }
> = {
  offline: { icon: CameraOff, label: 'Camera offline', tint: 'bg-red/12 text-red' },
  tamper: { icon: ShieldAlert, label: 'Tamper', tint: 'bg-red/12 text-red' },
  degraded: { icon: CloudOff, label: 'Degraded', tint: 'bg-amber/12 text-amber' },
  power: { icon: ZapOff, label: 'Power', tint: 'bg-amber/12 text-amber' },
};

export function AlertRow({
  alert,
  siteName,
  cameraName,
}: {
  alert: SiteAlert;
  siteName: string;
  cameraName?: string;
}) {
  const meta = TYPE_META[alert.type];
  const Icon = meta.icon;
  const open = !alert.resolvedIso;

  return (
    <div className="flex items-start gap-3.5 px-5 py-4 transition-colors hover:bg-white/[0.02]">
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
          meta.tint,
        )}
      >
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link
            href={`/sites/${alert.siteId}`}
            className="text-sm font-medium text-text transition-colors hover:text-teal"
          >
            {siteName}
          </Link>
          {cameraName ? (
            <span className="text-sm text-muted">· {cameraName}</span>
          ) : null}
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {meta.label}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{alert.note}</p>
        <p className="mt-1.5 text-xs text-muted">
          Opened {relativeTime(alert.openedIso)}
          {alert.resolvedIso
            ? ` · resolved ${relativeTime(alert.resolvedIso)}`
            : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
        <Badge variant={open ? 'danger' : 'muted'}>
          {open ? 'Open' : 'Resolved'}
        </Badge>
        {open ? <ResolveButton alertId={alert.id} /> : null}
      </div>
    </div>
  );
}
