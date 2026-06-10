'use client';

import { useEffect, useState } from 'react';
import { Timer, Wifi } from 'lucide-react';
import { Card } from '@/components/ui/card';

/** Streams run at ~0.45 GB/hour while watched. */
const MB_PER_SECOND = (0.45 * 1024) / 3600;

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatUsage(seconds: number): string {
  const mb = seconds * MB_PER_SECOND;
  if (mb < 1) return '<1 MB';
  if (mb < 10) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb).toLocaleString('en-IN')} MB`;
}

/**
 * Viewing-session meter: a ticking mm:ss timer plus the estimated data pulled
 * from the site's 4G at ~0.45 GB/hour. Both ticks skip while the tab is
 * hidden, and the data estimate additionally pauses whenever nothing is
 * actually playing (`streaming` false: offline/degraded camera, WHEP still
 * connecting or errored) — matching reality, since the stream only flows
 * while you watch.
 */
export function SessionPanel({ streaming }: { streaming: boolean }) {
  const [seconds, setSeconds] = useState(0);
  const [streamSeconds, setStreamSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Data is only pulled from the site while video actually flows.
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => {
      if (!document.hidden) setStreamSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [streaming]);

  return (
    <Card>
      <p className="text-[13px] font-medium text-muted">This session</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight tabular-nums text-text">
          {formatElapsed(seconds)}
        </span>
        <span className="text-[13px] text-muted">watching</span>
      </div>

      <div className="mt-5 space-y-3 border-t border-hairline pt-4">
        <div className="flex items-center gap-2.5">
          <Wifi size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
          <p className="text-[14px] text-text">
            <span className="font-medium tabular-nums">{formatUsage(streamSeconds)}</span>
            <span className="text-muted"> this session</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Timer size={16} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden />
          <p className="text-[14px] text-muted">Streaming at ~0.45 GB per hour</p>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-muted">
        Video streams from the site only while you watch — nothing uploads
        continuously on the site&apos;s 4G.
      </p>
    </Card>
  );
}
