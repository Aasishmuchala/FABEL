import { DoorOpen, Scan, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, relativeTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import type { BadgeVariant } from '@/components/ui/badge';
import type { Camera, CameraKind, CameraStatus } from '@/lib/types';

const KIND_ICONS: Record<CameraKind, LucideIcon> = {
  gate: DoorOpen,
  zone: Scan,
  solar: Sun,
};

const KIND_LABELS: Record<CameraKind, string> = {
  gate: 'Gate camera',
  zone: 'Zone camera',
  solar: 'Solar mast',
};

const STATUS_BADGE: Record<CameraStatus, { variant: BadgeVariant; label: string }> = {
  online: { variant: 'ok', label: 'Online' },
  degraded: { variant: 'warn', label: 'Degraded' },
  offline: { variant: 'danger', label: 'Offline' },
};

/**
 * Camera status card. Degraded/offline units get a border tint in the
 * matching status colour, consistent with the badge semantics.
 */
export function CameraCard({ camera }: { camera: Camera }) {
  const Icon = KIND_ICONS[camera.kind];
  const status = STATUS_BADGE[camera.status];

  return (
    <div
      className={cn(
        'rounded-[18px] border bg-surface p-5 shadow-card',
        camera.status === 'online' && 'border-hairline',
        camera.status === 'degraded' && 'border-warn/35',
        camera.status === 'offline' && 'border-danger/35',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
            <Icon size={16} strokeWidth={1.75} className="text-muted" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-text">{camera.name}</p>
            <p className="mt-0.5 text-[12px] font-medium text-muted">
              {KIND_LABELS[camera.kind]}
            </p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <p className="mt-4 text-[13px] text-muted">
        Last seen {relativeTime(camera.lastSeenIso)}
      </p>
    </div>
  );
}
