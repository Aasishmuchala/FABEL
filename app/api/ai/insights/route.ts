/**
 * POST /api/ai/insights — { siteId, force? } -> InsightsResult.
 *
 * 400 only for bad input (malformed body, unknown siteId). AI failures never
 * surface as errors: lib/ai falls back to its deterministic rules engine and
 * this route still returns 200 with `source: 'rules'`.
 */

import { getSiteInsights } from '@/lib/ai';
import { getSite } from '@/lib/store';

interface InsightsRequest {
  siteId: string;
  force: boolean;
}

const EXPECTED_SHAPE = '{ siteId: string, force?: boolean }';

function parseInsightsRequest(value: unknown): InsightsRequest | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.siteId !== 'string' || v.siteId.length === 0) return null;
  if (v.force !== undefined && typeof v.force !== 'boolean') return null;
  return { siteId: v.siteId, force: v.force === true };
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ error: 'Body must be valid JSON' }, { status: 400 });
  }

  const payload = parseInsightsRequest(raw);
  if (!payload) {
    return Response.json(
      { error: `Bad request body — expected ${EXPECTED_SHAPE}` },
      { status: 400 },
    );
  }

  if (!getSite(payload.siteId)) {
    return Response.json(
      { error: `Unknown siteId "${payload.siteId}"` },
      { status: 400 },
    );
  }

  const result = await getSiteInsights(payload.siteId, payload.force);
  return Response.json(result);
}
