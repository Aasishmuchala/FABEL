import { Video, VideoOff } from 'lucide-react';
import { cn } from '@/lib/format';
import type { CameraStatus } from '@/lib/types';

const STATUS_DOT: Record<CameraStatus, string> = {
  online: 'bg-chart-green animate-pulse',
  degraded: 'bg-chart-orange',
  offline: 'bg-danger',
};

const STATUS_LABEL: Record<CameraStatus, string> = {
  online: 'Live · on demand',
  degraded: 'Degraded',
  offline: 'Offline',
};

/**
 * Stylized 16:9 camera tile — near-black media surface on the light UI
 * (Apple-TV style), pure CSS scanline/noise effect, no media.
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

  return (
    <div
      className={cn(
        'live-tile-bg relative aspect-video w-full overflow-hidden rounded-[18px] bg-bg-deep',
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          <span
            className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])}
            aria-hidden
          />
          {STATUS_LABEL[status]}
        </span>
      </div>

      {/* camera label */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-2.5 py-2">
        {offline ? (
          <VideoOff
            size={13}
            strokeWidth={1.75}
            className="text-white/55"
            aria-hidden
          />
        ) : (
          <Video
            size={13}
            strokeWidth={1.75}
            className="text-white/55"
            aria-hidden
          />
        )}
        <span className="text-xs font-medium text-white/70">{label}</span>
      </div>
    </div>
  );
}
