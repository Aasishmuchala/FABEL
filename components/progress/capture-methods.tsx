import {
  Cctv,
  PersonStanding,
  Ruler,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { CAPTURE_METHOD_LABELS } from '@/lib/format';
import type { CaptureMethod } from '@/lib/types';

export const CAPTURE_METHOD_ICONS: Record<CaptureMethod, LucideIcon> = {
  'fixed-cams': Cctv,
  'walk-360': PersonStanding,
  'gate-sweep': Smartphone,
  'laser-tls': Ruler,
};

/** One-line meaning shown in the "How this site is recorded" strip. */
const CAPTURE_METHOD_MEANINGS: Record<CaptureMethod, string> = {
  'fixed-cams': 'continuous zones + gate',
  'walk-360': 'weekly engineer floor walk',
  'gate-sweep': 'phone capture at concealment gates',
  'laser-tls': 'milestone dimensions',
};

const ALL_METHODS: CaptureMethod[] = [
  'fixed-cams',
  'walk-360',
  'gate-sweep',
  'laser-tls',
];

/** Small icon chip naming one capture method; used on stage cards. */
export function CaptureMethodChip({ method }: { method: CaptureMethod }) {
  const Icon = CAPTURE_METHOD_ICONS[method];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[12px] font-medium text-muted">
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      {CAPTURE_METHOD_LABELS[method]}
    </span>
  );
}

/** Compact "How this site is recorded" strip — all four capture methods. */
export function CaptureMethodStrip() {
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-muted">
        How this site is recorded
      </p>
      <div className="flex flex-wrap gap-2">
        {ALL_METHODS.map((method) => {
          const Icon = CAPTURE_METHOD_ICONS[method];
          return (
            <div
              key={method}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-2 shadow-card"
            >
              <Icon
                size={15}
                strokeWidth={1.75}
                className="shrink-0 text-muted"
                aria-hidden
              />
              <span className="text-[13px] font-medium text-text">
                {CAPTURE_METHOD_LABELS[method]}
              </span>
              <span className="text-[12px] text-muted">
                — {CAPTURE_METHOD_MEANINGS[method]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
