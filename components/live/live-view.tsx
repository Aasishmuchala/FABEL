'use client';

import { useState } from 'react';
import { DoorOpen, Scan, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/format';
import type { Camera, CameraKind, CameraStatus } from '@/lib/types';
import { LivePlayer } from './live-player';
import { SessionPanel } from './session-panel';

const KIND_ICONS: Record<CameraKind, LucideIcon> = {
  gate: DoorOpen,
  zone: Scan,
  solar: Sun,
};

const STATUS_DOT: Record<CameraStatus, string> = {
  online: 'bg-chart-green animate-pulse',
  degraded: 'bg-chart-orange',
  offline: 'bg-danger',
};

function defaultFocus(cameras: Camera[]): string {
  const onlineGate = cameras.find((c) => c.kind === 'gate' && c.status === 'online');
  const online = cameras.find((c) => c.status === 'online');
  return (onlineGate ?? online ?? cameras[0]).id;
}

/**
 * Client shell for the live page: one large focused player, a clickable
 * thumbnail rail to swap focus, and the viewing-session panel.
 */
export function LiveView({
  cameras,
  streamBase,
}: {
  cameras: Camera[];
  streamBase: string | null;
}) {
  const [focusedId, setFocusedId] = useState(() => defaultFocus(cameras));
  const focused = cameras.find((c) => c.id === focusedId) ?? cameras[0];

  // True only while video actually flows: in WHEP mode the player reports its
  // connection state; the seeded demo feed plays whenever the camera is
  // online. Offline/degraded tiles and WHEP connect/error states don't count.
  const [whepLive, setWhepLive] = useState(false);
  const streaming =
    focused.status === 'online' && (streamBase ? whepLive : true);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {/* focused player — keyed so swapping cameras tears down cleanly */}
        <LivePlayer
          key={focused.id}
          cameraId={focused.id}
          cameraName={focused.name}
          kind={focused.kind}
          status={focused.status}
          streamBase={streamBase}
          large
          onStreamingChange={setWhepLive}
        />

        {/* thumbnail rail — plain toggle buttons, not ARIA tabs: there is no
            roving-tabindex/arrow-key wiring, so tab semantics would mislead
            screen-reader users. */}
        <div
          className="flex gap-3 overflow-x-auto pb-1"
          role="group"
          aria-label="Cameras"
        >
          {cameras.map((camera) => {
            const Icon = KIND_ICONS[camera.kind];
            const active = camera.id === focused.id;
            return (
              <button
                key={camera.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFocusedId(camera.id)}
                className={cn(
                  'live-tile-bg relative aspect-video w-36 shrink-0 overflow-hidden rounded-xl bg-bg-deep text-left transition',
                  active
                    ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
                    : 'opacity-75 hover:opacity-100',
                )}
              >
                <div className="live-tile-noise absolute inset-0" aria-hidden />
                <span
                  className={cn(
                    'absolute left-2 top-2 h-1.5 w-1.5 rounded-full',
                    STATUS_DOT[camera.status],
                  )}
                  aria-hidden
                />
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/25"
                  aria-hidden
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-2 pb-1.5 pt-3 text-[11px] font-medium text-white/80">
                  {camera.name}
                </span>
                {/* status is otherwise conveyed by dot color alone */}
                <span className="sr-only">{` — ${camera.status}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      <SessionPanel streaming={streaming} />
    </div>
  );
}
