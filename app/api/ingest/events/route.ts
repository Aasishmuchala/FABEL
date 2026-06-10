/**
 * POST /api/ingest/events — edge box reports a camera event
 * (offline / tamper / degraded / power).
 *
 * Log-and-acknowledge stub: validates shape, logs, returns the payload.
 * TODO(edge integration): open a SiteAlert via the store (auto-resolve the
 * matching open alert on a recovery event), and write the no-footage window
 * into the day's ledger summary so downtime is billable evidence.
 */

const EVENT_TYPES = ['offline', 'tamper', 'degraded', 'power'] as const;
type IngestEventType = (typeof EVENT_TYPES)[number];

interface EventPayload {
  siteId: string;
  cameraId: string;
  type: IngestEventType;
  atIso: string;
  note?: string;
}

const EXPECTED_SHAPE =
  '{ siteId: string, cameraId: string, type: "offline" | "tamper" | "degraded" | "power", atIso: ISO-8601 string, note?: string }';

function isEventType(value: string): value is IngestEventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

function parseEventPayload(value: unknown): EventPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.siteId !== 'string' || v.siteId.length === 0) return null;
  if (typeof v.cameraId !== 'string' || v.cameraId.length === 0) return null;
  if (typeof v.type !== 'string' || !isEventType(v.type)) return null;
  if (typeof v.atIso !== 'string' || Number.isNaN(Date.parse(v.atIso))) {
    return null;
  }
  if (v.note !== undefined && typeof v.note !== 'string') return null;

  return {
    siteId: v.siteId,
    cameraId: v.cameraId,
    type: v.type,
    atIso: v.atIso,
    ...(v.note !== undefined ? { note: v.note } : {}),
  };
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const payload = parseEventPayload(raw);
  if (!payload) {
    return Response.json(
      { error: `Bad request body — expected ${EXPECTED_SHAPE}` },
      { status: 400 },
    );
  }

  console.log(
    `[ingest/events] site=${payload.siteId} camera=${payload.cameraId} type=${payload.type} at=${payload.atIso}${payload.note ? ` note="${payload.note}"` : ''}`,
  );

  return Response.json({ ok: true, received: payload });
}
