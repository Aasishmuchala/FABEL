/**
 * Server-only Claude AI integration: deviation insights for one site.
 *
 * buildSitePacket() condenses the site's ledger into a compact JSON packet,
 * callClaude() sends it to claude-opus-4-7, and a deterministic rules engine
 * (heuristicInsights) produces the same shape whenever the API is missing,
 * slow, or returns something unparseable — the route never 500s for AI
 * failures.
 */

import Anthropic from '@anthropic-ai/sdk';
import { addDays } from '@/lib/seed';
import { formatDateShort, formatInr } from '@/lib/format';
import {
  getAlerts,
  getDailyCounts,
  getOrders,
  getReconciliations,
  getSite,
  getStages,
} from '@/lib/store';

/* ----------------------------------------------------------------- types */

export type InsightKind = 'deviation' | 'pattern' | 'risk' | 'action';
export type InsightConfidence = 'high' | 'medium' | 'low';

export interface Insight {
  kind: InsightKind;
  /** <= 70 chars. */
  title: string;
  /** <= 240 chars. */
  detail: string;
  confidence: InsightConfidence;
}

export interface InsightsResult {
  insights: Insight[];
  source: 'claude' | 'rules';
  generatedAt: string;
}

export interface SitePacket {
  site: {
    id: string;
    name: string;
    city: string;
    contractor: string;
    status: 'calibrated' | 'calibrating';
    gateChannelled: boolean;
    startedOn: string;
  };
  stages: Array<{
    name: string;
    order: number;
    status: 'verified' | 'in-progress' | 'locked';
    verifiedOn?: string;
    gateNote?: string;
  }>;
  /** Last 30 days, oldest -> newest. */
  dailyCounts: Array<{
    date: string;
    min: number;
    max: number;
    entries: number;
    exits: number;
  }>;
  /** All reconciled weeks, oldest -> newest. */
  reconciliations: Array<{
    week: string;
    billed: number;
    verifiedMin: number;
    verifiedMax: number;
    variancePct: number;
    flag: 'ok' | 'review' | 'variance';
  }>;
  alerts: Array<{
    type: 'offline' | 'tamper' | 'degraded' | 'power';
    opened: string;
    resolved?: string;
    note: string;
  }>;
  /** Orders still in 'placed' status. */
  openOrders: { count: number; totalInr: number };
}

/* ---------------------------------------------------------------- packet */

/** Compact JSON packet for one site — stays well under ~6000 tokens. */
export function buildSitePacket(siteId: string): SitePacket {
  const site = getSite(siteId);
  if (!site) throw new Error(`Unknown siteId "${siteId}"`);

  const openOrders = getOrders(siteId).filter((o) => o.status === 'placed');

  return {
    site: {
      id: site.id,
      name: site.name,
      city: site.city,
      contractor: site.contractor,
      status: site.status,
      gateChannelled: site.gateChannelled,
      startedOn: site.startedOn,
    },
    stages: getStages(siteId).map((s) => ({
      name: s.name,
      order: s.order,
      status: s.status,
      ...(s.verifiedOn ? { verifiedOn: s.verifiedOn } : {}),
      ...(s.gateNote ? { gateNote: s.gateNote } : {}),
    })),
    dailyCounts: getDailyCounts(siteId)
      .slice(-30)
      .map((c) => ({
        date: c.date,
        min: c.verifiedMin,
        max: c.verifiedMax,
        entries: c.gateEntries,
        exits: c.gateExits,
      })),
    reconciliations: getReconciliations(siteId)
      .map((r) => ({
        week: r.weekStart,
        billed: r.billedLabourDays,
        verifiedMin: r.verifiedMin,
        verifiedMax: r.verifiedMax,
        variancePct: r.variancePct,
        flag: r.flag,
      }))
      .sort((a, b) => a.week.localeCompare(b.week)),
    alerts: getAlerts(siteId).map((a) => ({
      type: a.type,
      opened: a.openedIso,
      ...(a.resolvedIso ? { resolved: a.resolvedIso } : {}),
      note: a.note,
    })),
    openOrders: {
      count: openOrders.length,
      totalInr: openOrders.reduce((s, o) => s + o.totalInr, 0),
    },
  };
}

/* ---------------------------------------------------------------- claude */

const SYSTEM =
  'You are a construction-quality analyst for Indian residential sites. You receive a JSON packet for one site: stage statuses with quality gates, the last 30 days of camera-verified labour counts (verified min-max range, gate entries/exits), weekly reconciliations of contractor-billed labour-days against the verified range, camera alerts, and open material order totals. Analyse the packet, return ONLY a JSON object {"insights":[{"kind":"deviation"|"pattern"|"risk"|"action","title":string(<=70 chars),"detail":string(<=240 chars),"confidence":"high"|"medium"|"low"}]} with 3-6 insights ordered by importance. Focus on: billed-vs-verified deviation patterns (day-of-week padding, trend direction), camera-downtime correlation with variance, calibration caveats, stage-gate / procurement risks, concrete next actions for the builder. No markdown, no prose outside the JSON.';

async function callClaude(packet: SitePacket): Promise<string> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    maxRetries: 1,
    timeout: 90000,
  });
  // Non-streaming on purpose: the user's API proxy rejects streaming requests.
  const msg = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(packet) }],
  });
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/* ----------------------------------------------------------- robust parse */

const KINDS: readonly InsightKind[] = ['deviation', 'pattern', 'risk', 'action'];
const CONFIDENCES: readonly InsightConfidence[] = ['high', 'medium', 'low'];

/** First balanced {...} block in the text (string-aware), or null. */
function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function clampText(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/** Parse + validate Claude's reply into 3-6 insights; null on any failure. */
function parseInsights(text: string): Insight[] | null {
  const json = extractFirstJsonObject(text);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const raw = (parsed as Record<string, unknown>).insights;
  if (!Array.isArray(raw)) return null;

  const insights: Insight[] = [];
  // More than 6 valid insights: keep the top 6 (they are ordered by
  // importance) rather than discarding an otherwise usable response.
  for (const item of raw.slice(0, 6)) {
    if (typeof item !== 'object' || item === null) return null;
    const o = item as Record<string, unknown>;
    if (!KINDS.includes(o.kind as InsightKind)) return null;
    if (!CONFIDENCES.includes(o.confidence as InsightConfidence)) return null;
    if (typeof o.title !== 'string' || o.title.trim().length === 0) return null;
    if (typeof o.detail !== 'string' || o.detail.trim().length === 0) return null;
    insights.push({
      kind: o.kind as InsightKind,
      title: clampText(o.title, 70),
      detail: clampText(o.detail, 240),
      confidence: o.confidence as InsightConfidence,
    });
  }
  if (insights.length < 3) return null;
  return insights;
}

/* ----------------------------------------------------------- rules engine */

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((s, v) => s + v, 0) / values.length;
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Deterministic fallback: same shape as Claude's output, computed from the
 * packet's real reconciliation / alert / count data. Always returns 3-6
 * insights ordered by importance.
 */
function heuristicInsights(packet: SitePacket): Insight[] {
  const out: Insight[] = [];
  const recons = packet.reconciliations; // already oldest -> newest
  const calibrating = packet.site.status === 'calibrating';
  const baseConfidence: InsightConfidence = calibrating ? 'medium' : 'high';
  const inProgress = packet.stages.find((s) => s.status === 'in-progress');

  /* 1 — variance trend: avg of the last 3 weeks vs the 3 before them. */
  if (recons.length >= 2) {
    const recent = recons.slice(-3);
    const prior = recons.slice(0, -recent.length).slice(-3);
    const recentAvg = Math.round(mean(recent.map((r) => r.variancePct)));
    if (prior.length > 0) {
      const priorAvg = Math.round(mean(prior.map((r) => r.variancePct)));
      const delta = recentAvg - priorAvg;
      if (delta > 2) {
        out.push({
          kind: 'deviation',
          title: clampText(
            `Billing variance rising: +${recentAvg}% avg over the last 3 weeks`,
            70,
          ),
          detail: clampText(
            `Average billed-vs-verified variance moved from +${priorAvg}% to +${recentAvg}% week-on-week at ${packet.site.name}. Hold the next payment until the worst weeks are checked against gate footage.`,
            240,
          ),
          confidence: baseConfidence,
        });
      } else if (delta < -2) {
        out.push({
          kind: 'deviation',
          title: clampText(
            `Billing variance easing: +${recentAvg}% avg, down from +${priorAvg}%`,
            70,
          ),
          detail: clampText(
            `Recent weeks average +${recentAvg}% against the verified range, down from +${priorAvg}% earlier. The camera-verified ledger is pulling billed labour-days towards reality — keep reconciling weekly.`,
            240,
          ),
          confidence: baseConfidence,
        });
      } else {
        out.push({
          kind: 'deviation',
          title: clampText(
            `Billing variance steady around +${recentAvg}% week to week`,
            70,
          ),
          detail: clampText(
            `Variance has held near +${recentAvg}% across recent weeks (earlier average +${priorAvg}%). ${recentAvg > 5 ? 'A persistent gap this size is structural padding, not noise — renegotiate muster practice with the contractor.' : 'Within tolerance; keep the weekly cadence.'}`,
            240,
          ),
          confidence: 'medium',
        });
      }
    }
  }

  /* 2 — worst week callout (or all-clear when nothing crosses review). */
  if (recons.length > 0) {
    const worst = recons.reduce((a, b) => (b.variancePct > a.variancePct ? b : a));
    if (worst.variancePct >= 5) {
      out.push({
        kind: 'deviation',
        title: clampText(
          `Worst week +${worst.variancePct}%: billed ${worst.billed} vs ${worst.verifiedMin}–${worst.verifiedMax} verified`,
          70,
        ),
        detail: clampText(
          `Week of ${formatDateShort(worst.week)} — ${packet.site.contractor} billed ${worst.billed} labour-days against a camera-verified ${worst.verifiedMin}–${worst.verifiedMax}. Pull that week's gate clips as evidence before clearing the bill.`,
          240,
        ),
        confidence: baseConfidence,
      });
    } else {
      out.push({
        kind: 'deviation',
        title: clampText(
          `Billing within tolerance: worst week +${worst.variancePct}%`,
          70,
        ),
        detail: clampText(
          `No reconciled week exceeded the 5% review threshold; the worst was +${worst.variancePct}% in the week of ${formatDateShort(worst.week)}. Billed labour-days are tracking the verified range.`,
          240,
        ),
        confidence: baseConfidence,
      });
    }
  }

  /* 3 — camera downtime (tamper/offline) correlated with variance weeks. */
  const downtime = packet.alerts.filter(
    (a) => a.type === 'tamper' || a.type === 'offline',
  );
  if (downtime.length > 0) {
    const tamper = downtime.find((a) => a.type === 'tamper') ?? downtime[0];
    const day = tamper.opened.slice(0, 10);
    const hitWeek = recons.find(
      (r) => day >= r.week && day <= addDays(r.week, 6),
    );
    if (hitWeek && hitWeek.variancePct >= 5) {
      out.push({
        kind: 'risk',
        title: clampText(
          `Camera ${tamper.type} overlaps a +${hitWeek.variancePct}% variance week`,
          70,
        ),
        detail: clampText(
          `A ${tamper.type} window opened ${formatDateShort(day)} sits inside the week of ${formatDateShort(hitWeek.week)} (+${hitWeek.variancePct}% vs verified). No-footage hours are where padding hides — treat that window as builder-verified only and audit the muster sheet.`,
          240,
        ),
        confidence: 'high',
      });
    } else {
      out.push({
        kind: 'risk',
        title: clampText(
          `${downtime.length} camera-downtime window${downtime.length === 1 ? '' : 's'} logged — verify coverage`,
          70,
        ),
        detail: clampText(
          `${downtime.length === 1 ? 'A' : `${downtime.length}`} ${downtime.map((a) => a.type).join(' + ')} event${downtime.length === 1 ? '' : 's'} interrupted footage. Counts in those windows carry lower confidence; cross-check the affected days against entry/exit totals before relying on them in a dispute.`,
          240,
        ),
        confidence: 'medium',
      });
    }
  }

  /* 4 — gate-blocked procurement / next-gate action. */
  const blocked = packet.stages.find(
    (s) => s.status === 'locked' && s.gateNote,
  );
  if (blocked) {
    out.push({
      kind: 'action',
      title: clampText(
        `Procurement blocked: ${blocked.name} awaits the previous gate`,
        70,
      ),
      detail: clampText(
        `${blocked.gateNote ?? 'Previous stage gate pending.'} Get ${inProgress?.name ?? 'the current stage'} through its quality gate before scheduling vendor deliveries for ${blocked.name} — material on site before the gate passes is dead capital.`,
        240,
      ),
      confidence: 'high',
    });
  } else if (inProgress) {
    out.push({
      kind: 'action',
      title: clampText(
        `Next gate: verify ${inProgress.name} to unlock stage ${inProgress.order + 1}`,
        70,
      ),
      detail: clampText(
        `Materials for the next stage stay locked until ${inProgress.name} passes its quality gate. Line up the verification evidence (photos, test reports) early so procurement is not the idle-day bottleneck.`,
        240,
      ),
      confidence: 'high',
    });
  }

  /* 5 — calibration caveat. */
  if (calibrating) {
    out.push({
      kind: 'risk',
      title: 'Counts still calibrating — verified ranges are wider on purpose',
      detail: clampText(
        `${packet.site.name} is in its calibration window${packet.site.gateChannelled ? '' : ' and the gate is not yet channelled'}; verified ranges run ~±10% until calibration locks. Treat variance flags as provisional — avoid contractor disputes on this data yet.`,
        240,
      ),
      confidence: 'high',
    });
  }

  /* 6 — day-of-week pattern from gate entries (Mon/Fri padding signature). */
  const byDow = new Map<number, number[]>();
  for (const d of packet.dailyCounts) {
    const dow = weekdayOf(d.date);
    if (dow === 0) continue; // Sundays run reduced crews by design
    const list = byDow.get(dow) ?? [];
    list.push(d.entries);
    byDow.set(dow, list);
  }
  const weekdayAvg = mean([...byDow.values()].flat());
  if (weekdayAvg > 0) {
    const candidates = [1, 5]
      .filter((dow) => (byDow.get(dow)?.length ?? 0) >= 2)
      .map((dow) => {
        const avg = mean(byDow.get(dow) ?? []);
        return { dow, avg, deltaPct: ((avg - weekdayAvg) / weekdayAvg) * 100 };
      })
      .filter((c) => Math.abs(c.deltaPct) >= 8)
      .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));
    if (candidates.length > 0) {
      const c = candidates[0];
      const name = WEEKDAY_NAMES[c.dow];
      const dir = c.deltaPct > 0 ? 'above' : 'below';
      out.push({
        kind: 'pattern',
        title: clampText(
          `${name} gate entries run ${Math.abs(Math.round(c.deltaPct))}% ${dir} the weekday norm`,
          70,
        ),
        detail: clampText(
          `${name}s average ${Math.round(c.avg)} entries vs ${Math.round(weekdayAvg)} across weekdays in the last 30 days. ${c.deltaPct < 0 ? 'Flat daily billing over a dip like this is the classic padding signature — compare muster sheets for those dates.' : 'Check whether billed headcounts spike to match, or stay flat while attendance surges.'}`,
          240,
        ),
        confidence: 'medium',
      });
    }
  }

  /* 7 — fillers so the result always has at least 3 insights. */
  if (out.length < 3 && packet.openOrders.count > 0) {
    out.push({
      kind: 'action',
      title: clampText(
        `${packet.openOrders.count} open material order${packet.openOrders.count === 1 ? '' : 's'} worth ${formatInr(packet.openOrders.totalInr)} en route`,
        70,
      ),
      detail: clampText(
        `Match each delivery against gate-entry timestamps on arrival so the ledger holds materials evidence alongside labour${inProgress ? ` for ${inProgress.name}` : ''}. Short deliveries surface fastest at the gate.`,
        240,
      ),
      confidence: 'medium',
    });
  }
  if (out.length < 3 && packet.dailyCounts.length > 0) {
    const mids = packet.dailyCounts.map((d) => (d.min + d.max) / 2);
    out.push({
      kind: 'pattern',
      title: clampText(
        `${packet.dailyCounts.length} days on the verified ledger, ~${Math.round(mean(mids))} workers/day`,
        70,
      ),
      detail: clampText(
        `Camera-verified counts cover the last ${packet.dailyCounts.length} days with a mid-range average of ${Math.round(mean(mids))} workers/day. Each day is hash-chained — use it as the baseline for every contractor bill.`,
        240,
      ),
      confidence: baseConfidence,
    });
  }
  if (out.length < 3) {
    out.push({
      kind: 'action',
      title: 'Ledger still thin — keep the weekly reconciliation cadence',
      detail: clampText(
        `${packet.site.name} has limited reconciled history so far. Submit contractor bills weekly so each one reconciles against a full 7-day verified window — trends and padding patterns emerge after 3-4 weeks.`,
        240,
      ),
      confidence: 'medium',
    });
  }

  return out.slice(0, 6);
}

/* ------------------------------------------------------------------ cache */

const CACHE_TTL_MS = 10 * 60 * 1000;
/**
 * Fallback results cache briefly so a transient Claude failure (network blip,
 * timeout) self-heals on the next request instead of pinning the rules-engine
 * badge for the full 10 minutes.
 */
const RULES_CACHE_TTL_MS = 60 * 1000;
const cache = new Map<string, { expires: number; result: InsightsResult }>();

/**
 * Insights for a site: Claude when reachable + parseable, the deterministic
 * rules engine otherwise. Cached per site — 10 minutes for Claude results,
 * 60 seconds for rules fallbacks; `force` busts it. Never throws for AI
 * failures (only for an unknown siteId).
 */
export async function getSiteInsights(
  siteId: string,
  force = false,
): Promise<InsightsResult> {
  const hit = cache.get(siteId);
  if (!force && hit && hit.expires > Date.now()) return hit.result;

  const packet = buildSitePacket(siteId);

  let insights: Insight[] | null = null;
  let source: InsightsResult['source'] = 'rules';
  try {
    const text = await callClaude(packet);
    insights = parseInsights(text);
    if (insights) source = 'claude';
  } catch {
    // Missing key, network error, timeout, proxy refusal — fall through to rules.
  }
  if (!insights) insights = heuristicInsights(packet);

  const result: InsightsResult = {
    insights,
    source,
    generatedAt: new Date().toISOString(),
  };
  const ttl = source === 'claude' ? CACHE_TTL_MS : RULES_CACHE_TTL_MS;
  cache.set(siteId, { expires: Date.now() + ttl, result });
  return result;
}
