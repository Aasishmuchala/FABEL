'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, VideoOff } from 'lucide-react';
import { cn } from '@/lib/format';
import type { CameraKind, CameraStatus } from '@/lib/types';
import { createDemoRenderer, DEMO_HEIGHT, DEMO_WIDTH } from './demo-scene';

export interface LivePlayerProps {
  cameraId: string;
  cameraName: string;
  kind: CameraKind;
  status: CameraStatus;
  /** WHEP host (e.g. a MediaMTX/go2rtc box). Absent → seeded demo feed. */
  streamBase?: string | null;
  large?: boolean;
  /**
   * Reports whether WHEP video is actually flowing (connected, not
   * connecting/errored). Only fired in WHEP mode — demo and static tiles
   * never pull from the site's 4G.
   */
  onStreamingChange?: (streaming: boolean) => void;
}

/** Ticking IST wall clock, "HH:MM:SS". Empty until mounted (no hydration drift). */
function useIstClock(): string {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function OverlayBar({
  cameraName,
  demo,
  large,
}: {
  cameraName: string;
  demo: boolean;
  large?: boolean;
}) {
  const clock = useIstClock();
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2.5 bg-gradient-to-b from-black/60 via-black/25 to-transparent',
        large ? 'px-4 py-3' : 'px-3 py-2.5',
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
      </span>
      <span className="text-[11px] font-semibold text-white">Live</span>
      <span
        className={cn(
          'truncate font-medium text-white/85',
          large ? 'text-[13px]' : 'text-[12px]',
        )}
      >
        {cameraName}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {demo ? (
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium text-white/75 backdrop-blur">
            Demo feed
          </span>
        ) : null}
        <span className="text-[12px] tabular-nums text-white/70" suppressHydrationWarning>
          {clock}
        </span>
      </span>
    </div>
  );
}

/**
 * Demo mode — a seeded canvas night-scene piped into the <video> via
 * captureStream(12). The rAF loop pauses while the tab is hidden and every
 * element of the scene is a pure function of time, so resuming never jumps.
 */
function DemoFeed({
  cameraId,
  cameraName,
  kind,
  large,
}: {
  cameraId: string;
  cameraName: string;
  kind: CameraKind;
  large?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = DEMO_WIDTH;
    canvas.height = DEMO_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = createDemoRenderer(ctx, cameraId, kind);
    draw(performance.now() / 1000); // first frame before the stream attaches
    const stream = canvas.captureStream(12);
    video.srcObject = stream;
    void video.play().catch(() => {
      /* autoplay is muted; a rejection here is benign */
    });

    let raf = 0;
    let last = 0;
    const FRAME_MS = 1000 / 12;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      draw(now / 1000);
    };
    const start = () => {
      if (raf === 0) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [cameraId, kind]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        aria-label={`Demo live feed — ${cameraName}`}
      />
      {/* subtle CSS noise/flicker on top of the canvas feed */}
      <div className="live-tile-noise pointer-events-none absolute inset-0" aria-hidden />
      <OverlayBar cameraName={cameraName} demo large={large} />
    </>
  );
}

type WhepState = 'connecting' | 'live' | 'error';

/**
 * Real mode — WHEP over WebRTC: POST the SDP offer to
 * `${streamBase}/${cameraId}/whep`, apply the answer, attach the track.
 * Remounted (fresh key) by the parent on Retry.
 */
function WhepFeed({
  cameraId,
  cameraName,
  streamBase,
  large,
  onRetry,
  onStreamingChange,
}: {
  cameraId: string;
  cameraName: string;
  streamBase: string;
  large?: boolean;
  onRetry: () => void;
  onStreamingChange?: (streaming: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<WhepState>('connecting');

  // Tell the parent when video is actually flowing so the session data meter
  // only counts watched seconds (and resets to false on unmount/camera swap).
  useEffect(() => {
    onStreamingChange?.(state === 'live');
    return () => onStreamingChange?.(false);
  }, [state, onStreamingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    const pc = new RTCPeerConnection();
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.ontrack = (event) => {
      if (cancelled) return;
      video.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      void video.play().catch(() => {
        /* muted autoplay */
      });
    };
    pc.onconnectionstatechange = () => {
      if (cancelled) return;
      if (pc.connectionState === 'connected') setState('live');
      else if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'closed'
      ) {
        setState('error');
      }
    };

    (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const res = await fetch(`${streamBase}/${cameraId}/whep`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: offer.sdp ?? '',
        });
        if (!res.ok) throw new Error(`WHEP endpoint returned ${res.status}`);
        const answer = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      pc.close();
      video.srcObject = null;
    };
  }, [cameraId, streamBase]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        aria-label={`Live feed — ${cameraName}`}
      />
      {state === 'connecting' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/70"
            aria-hidden
          />
          <p className="text-[13px] font-medium text-white/70">Connecting to site…</p>
        </div>
      ) : null}
      {state === 'error' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-[13px] font-medium text-white/75">
            Could not reach the site edge box.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/12 px-4 text-[13px] font-medium text-white backdrop-blur transition hover:bg-white/20"
          >
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden />
            Retry
          </button>
        </div>
      ) : null}
      {state === 'live' ? (
        <OverlayBar cameraName={cameraName} demo={false} large={large} />
      ) : null}
    </>
  );
}

const STATIC_MESSAGE: Record<Exclude<CameraStatus, 'online'>, string> = {
  offline: 'Camera offline — feed unavailable',
  degraded: 'Feed degraded — image confidence below threshold',
};

/**
 * On-demand camera player on a near-black media surface. Online cameras play
 * either the real WHEP stream (when `streamBase` is set) or a seeded demo
 * scene; offline/degraded cameras render a static status tile.
 */
export function LivePlayer({
  cameraId,
  cameraName,
  kind,
  status,
  streamBase,
  large,
  onStreamingChange,
}: LivePlayerProps) {
  const [attempt, setAttempt] = useState(0);
  const watchable = status === 'online';

  return (
    <div className="live-tile-bg relative aspect-video w-full overflow-hidden rounded-[18px] bg-bg-deep">
      {!watchable ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <VideoOff size={22} strokeWidth={1.75} className="text-white/35" aria-hidden />
          <p className="text-[13px] font-medium text-white/65">
            {STATIC_MESSAGE[status]}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                status === 'offline' ? 'bg-danger' : 'bg-chart-orange',
              )}
              aria-hidden
            />
            {cameraName}
          </span>
        </div>
      ) : streamBase ? (
        <WhepFeed
          key={attempt}
          cameraId={cameraId}
          cameraName={cameraName}
          streamBase={streamBase}
          large={large}
          onRetry={() => setAttempt((a) => a + 1)}
          onStreamingChange={onStreamingChange}
        />
      ) : (
        <DemoFeed cameraId={cameraId} cameraName={cameraName} kind={kind} large={large} />
      )}
    </div>
  );
}
