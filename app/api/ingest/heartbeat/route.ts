/**
 * POST /api/ingest/heartbeat — edge box liveness ping (every few minutes).
 *
 * Log-and-acknowledge stub: validates shape, logs, returns the payload.
 * TODO(edge integration): update Camera.lastSeenIso for the site's cameras,
 * mark cameras offline when heartbeats stop, and open an 'offline' SiteAlert
 * after the grace window so the gap lands in the ledger.
 */

interface HeartbeatPayload {
  siteId: string;
  deviceId: string;
  atIso: string;
  camerasOnline: number;
}

const EXPECTED_SHAPE =
  '{ siteId: string, deviceId: string, atIso: ISO-8601 string, camerasOnline: number }';

function parseHeartbeatPayload(value: unknown): HeartbeatPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.siteId !== 'string' || v.siteId.length === 0) return null;
  if (typeof v.deviceId !== 'string' || v.deviceId.length === 0) return null;
  if (typeof v.atIso !== 'string' || Number.isNaN(Date.parse(v.atIso))) {
    return null;
  }
  if (
    typeof v.camerasOnline !== 'number' ||
    !Number.isInteger(v.camerasOnline) ||
    v.camerasOnline < 0
  ) {
    return null;
  }

  return {
    siteId: v.siteId,
    deviceId: v.deviceId,
    atIso: v.atIso,
    camerasOnline: v.camerasOnline,
  };
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const payload = parseHeartbeatPayload(raw);
  if (!payload) {
    return Response.json(
      { error: `Bad request body — expected ${EXPECTED_SHAPE}` },
      { status: 400 },
    );
  }

  console.log(
    `[ingest/heartbeat] site=${payload.siteId} device=${payload.deviceId} at=${payload.atIso} camerasOnline=${payload.camerasOnline}`,
  );

  return Response.json({ ok: true, received: payload });
}
