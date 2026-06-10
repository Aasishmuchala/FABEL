/**
 * POST /api/ingest/counts — edge box pushes gate counts for a site + date.
 *
 * Log-and-acknowledge stub: validates shape, logs, returns the payload.
 * TODO(edge integration): merge into the site's DailyCount for `date`
 * (recompute verifiedMin/verifiedMax from occupancySamples, bump samples,
 * update peakOccupancy) and append/refresh the day's hash-chained
 * LedgerEntry via the store.
 */

interface CountsPayload {
  siteId: string;
  date: string;
  gateEntries: number;
  gateExits: number;
  occupancySamples: number[];
}

const EXPECTED_SHAPE =
  '{ siteId: string, date: "YYYY-MM-DD", gateEntries: number, gateExits: number, occupancySamples: number[] }';

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseCountsPayload(value: unknown): CountsPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.siteId !== 'string' || v.siteId.length === 0) return null;
  if (typeof v.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) {
    return null;
  }
  if (!isNonNegativeNumber(v.gateEntries)) return null;
  if (!isNonNegativeNumber(v.gateExits)) return null;

  const rawSamples = v.occupancySamples;
  if (!Array.isArray(rawSamples)) return null;
  const occupancySamples: number[] = [];
  for (const sample of rawSamples) {
    if (!isNonNegativeNumber(sample)) return null;
    occupancySamples.push(sample);
  }

  return {
    siteId: v.siteId,
    date: v.date,
    gateEntries: v.gateEntries,
    gateExits: v.gateExits,
    occupancySamples,
  };
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const payload = parseCountsPayload(raw);
  if (!payload) {
    return Response.json(
      { error: `Bad request body — expected ${EXPECTED_SHAPE}` },
      { status: 400 },
    );
  }

  console.log(
    `[ingest/counts] site=${payload.siteId} date=${payload.date} entries=${payload.gateEntries} exits=${payload.gateExits} samples=${payload.occupancySamples.length}`,
  );

  return Response.json({ ok: true, received: payload });
}
