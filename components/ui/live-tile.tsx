import { Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/format';
import type { CameraStatus } from '@/lib/types';

/**
 * Stylized 16:9 camera tile — pure CSS scanline/noise effect, no media.
 * Online tiles show a "LIVE · on demand" badge; degraded/offline are tinted.
 */
export function LiveTile({
  label,
  status = 'online',
  className,
}: {
  label: string;
  status?: CameraStatus;
  className?: string;
}) {
  const offline = status === 'offline';
  const degraded = status === 'degraded';

  return (
    <div
      className={cn(
        'live-tile-bg relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-bg-deep',
        className,
      )}
    >
      {/* noise + scanline (pure CSS) */}
      <div className="live-tile-noise absolute inset-0" aria-hidden />
      {!offline ? (
        <div
          className="live-tile-scan absolute inset-x-0 top-0 h-1/4"
          aria-hidden
        />
      ) : null}

      {/* status badge */}
      <div className="absolute left-2.5 top-2.5">
        {offline ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-red">
            <span className="h-1.5 w-1.5 rounded-full bg-red" aria-hidden />
            Offline
          </span>
        ) : degraded ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber">
            <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden />
            Degraded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-teal">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal"
              aria-hidden
            />
            Live · on demand
          </span>
        )}
      </div>

      {/* camera label */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 py-2">
        {offline ? (
          <VideoOff size={13} className="text-red" aria-hidden />
        ) : (
          <Video
            size={13}
            className={degraded ? 'text-amber' : 'text-muted'}
            aria-hidden
          />
        )}
        <span className="text-xs font-medium text-muted">{label}</span>
      </div>
    </div>
  );
}
