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
 * Camera status card. Degraded/offline units get a full border tint in the
 * matching status colour, consistent with the badge semantics.
 */
export function CameraCard({ camera }: { camera: Camera }) {
  const Icon = KIND_ICONS[camera.kind];
  const status = STATUS_BADGE[camera.status];

  return (
    <div
      className={cn(
        'rounded-2xl border bg-surface p-5 transition-colors',
        camera.status === 'online' && 'border-line hover:border-white/15',
        camera.status === 'degraded' && 'border-amber/35 hover:border-amber/50',
        camera.status === 'offline' && 'border-red/35 hover:border-red/50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2">
            <Icon size={16} className="text-muted" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium text-text">{camera.name}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-muted">
              {KIND_LABELS[camera.kind]}
            </p>
          </div>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>
      <p className="mt-4 text-xs text-muted">
        Last seen {relativeTime(camera.lastSeenIso)}
      </p>
    </div>
  );
}
