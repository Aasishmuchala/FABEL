import { Film } from 'lucide-react';
import { formatDateShort } from '@/lib/format';
import type { EvidenceClip } from '@/lib/types';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Evidence clip list — camera, time, label, duration. Clips are AI-bookmarked
 * moments, so they carry the purple AI/insight color (matching the evidence
 * drawer). Playback affordance arrives with real clip storage.
 */
export function ClipList({ clips }: { clips: EvidenceClip[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <ul className="divide-y divide-line">
        {clips.map((clip) => (
          <li
            key={clip.id}
            className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/40"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2">
              <Film size={14} className="text-purple" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-text">
                {clip.label}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {clip.cameraName} · {formatDateShort(clip.date)} · {clip.time}
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-muted">
              {formatDuration(clip.durationSec)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
