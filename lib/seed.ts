import { createHash } from 'node:crypto';
import type {
  Bill,
  BoqItem,
  Camera,
  DailyCount,
  Db,
  EvidenceClip,
  LedgerEntry,
  MaterialOrder,
  OrderLine,
  Reconciliation,
  ReconciliationFlag,
  Site,
  SiteAlert,
  Stage,
  Vendor,
} from './types';

/** Blended daily labour rate (₹/labour-day) used across bills and savings. */
export const DAILY_RATE_INR = 650;

/**
 * Bump whenever the seed/db shape changes — the store bootstrap regenerates
 * any data/db.json whose seedVersion does not match.
 */
export const SEED_VERSION = 2;

/* ---------------------------------------------------------------- PRNG */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- dates */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoDate(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function daysAgo(n: number): string {
  return toDateStr(daysAgoDate(n));
}

/** Local ISO timestamp (no TZ suffix) for a date string + HH:MM. */
function isoAt(date: string, time: string): string {
  return `${date}T${time}:00`;
}

/** date + n days, both as local YYYY-MM-DD strings. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  dt.setDate(dt.getDate() + n);
  return toDateStr(dt);
}

/** Today as a local YYYY-MM-DD string. */
export function todayStr(): string {
  return daysAgo(0);
}

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

/** Monday (YYYY-MM-DD) of the week containing the given date string. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  const offset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - offset);
  return toDateStr(dt);
}

/* ------------------------------------------------------- shared maths */

/** sha256(prevHash + date + JSON of the day's count), first 16 hex chars. */
export function computeLedgerHash(
  prevHash: string,
  date: string,
  count: DailyCount,
): string {
  return createHash('sha256')
    .update(prevHash + date + JSON.stringify(count))
    .digest('hex')
    .slice(0, 16);
}

export interface VarianceResult {
  verifiedMin: number;
  verifiedMax: number;
  variancePct: number;
  flag: ReconciliationFlag;
  savingsInr: number;
}

/** Variance math per spec: mid-sum vs billed; flag <5 ok, 5–12 review, >12 variance. */
export function computeVariance(
  billedLabourDays: number,
  weekCounts: DailyCount[],
): VarianceResult {
  const verifiedMin = weekCounts.reduce((s, c) => s + c.verifiedMin, 0);
  const verifiedMax = weekCounts.reduce((s, c) => s + c.verifiedMax, 0);
  const midSum = weekCounts.reduce(
    (s, c) => s + (c.verifiedMin + c.verifiedMax) / 2,
    0,
  );
  const variancePct =
    billedLabourDays > 0
      ? Math.round(((billedLabourDays - midSum) / billedLabourDays) * 100)
      : 0;
  const flag: ReconciliationFlag =
    variancePct < 5 ? 'ok' : variancePct <= 12 ? 'review' : 'variance';
  const savingsInr =
    Math.max(0, billedLabourDays - verifiedMax) * DAILY_RATE_INR;
  return { verifiedMin, verifiedMax, variancePct, flag, savingsInr };
}

/* ---------------------------------------------------------------- seed */

const SITE_1 = 'sunrise-heights';
const SITE_2 = 'gvr-meadows';
const SITE_3 = 'lakeview-residency';

const TAMPER_DAYS_AGO = 12;

export function generateSeed(): Db {
  const rng = mulberry32(42);
  const rand = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));

  const today = daysAgo(0);
  const currentMonday = mondayOf(today);
  const tamperDate = daysAgo(TAMPER_DAYS_AGO);

  /* sites */
  const sites: Site[] = [
    {
      id: SITE_1,
      name: 'Sunrise Heights',
      city: 'Hyderabad',
      contractor: 'SR Constructions',
      status: 'calibrated',
      gateChannelled: true,
      startedOn: daysAgo(76),
      tagline: "Pilot zero — founder's own site",
    },
    {
      id: SITE_2,
      name: 'GVR Meadows',
      city: 'Hyderabad',
      contractor: 'GVR Labour Co',
      status: 'calibrated',
      gateChannelled: true,
      startedOn: daysAgo(68),
    },
    {
      id: SITE_3,
      name: 'Lakeview Residency',
      city: 'Warangal',
      contractor: 'Sai Teja Works',
      status: 'calibrating',
      gateChannelled: false,
      startedOn: daysAgo(13),
    },
  ];

  /* cameras: per site 2 gate + 3 zone + 1 solar */
  const cameras: Camera[] = [];
  const nowMs = Date.now();
  for (const site of sites) {
    const defs: Array<{ name: string; kind: Camera['kind']; slug: string }> = [
      { name: 'Gate cam 1', kind: 'gate', slug: 'gate-1' },
      { name: 'Gate cam 2', kind: 'gate', slug: 'gate-2' },
      { name: 'Zone cam A', kind: 'zone', slug: 'zone-a' },
      { name: 'Zone cam B', kind: 'zone', slug: 'zone-b' },
      { name: 'Zone cam C', kind: 'zone', slug: 'zone-c' },
      { name: 'Solar mast cam', kind: 'solar', slug: 'solar-1' },
    ];
    for (const def of defs) {
      const degraded = site.id === SITE_3 && def.slug === 'zone-a';
      cameras.push({
        id: `${site.id}-${def.slug}`,
        siteId: site.id,
        name: def.name,
        kind: def.kind,
        status: degraded ? 'degraded' : 'online',
        lastSeenIso: new Date(
          nowMs - randInt(20, 240) * 1000 - (degraded ? 90_000 : 0),
        ).toISOString(),
      });
    }
  }

  /* daily counts */
  const dailyCounts: DailyCount[] = [];
  const countsBySite = new Map<string, DailyCount[]>();

  const makeDay = (
    siteId: string,
    date: string,
    baseMid: number,
    halfWidth: number,
    confidence: DailyCount['confidence'],
  ): DailyCount => {
    const sunday = dayOfWeek(date) === 0;
    let mid = sunday ? baseMid * rand(0.5, 0.62) : baseMid;
    mid = Math.max(4, mid);
    let min = Math.max(2, Math.round(mid - halfWidth));
    let max = Math.round(mid + halfWidth);
    let samples =
      confidence === 'calibrated' ? randInt(280, 340) : randInt(150, 220);

    // The tamper day on GVR Meadows: 26 h no-footage window widens the range.
    const tampered = siteId === SITE_2 && date === tamperDate;
    if (tampered) {
      min = Math.max(2, min - 3);
      max = max + 2;
      samples = Math.round(samples * 0.45);
    }

    const gateEntries = Math.round(mid * rand(1.08, 1.26));
    const gateExits = Math.max(0, gateEntries - randInt(0, 2));
    const peakOccupancy = Math.max(min, max - randInt(0, 1));

    return {
      siteId,
      date,
      verifiedMin: min,
      verifiedMax: max,
      gateEntries,
      gateExits,
      peakOccupancy,
      samples,
      confidence,
    };
  };

  // Site 1: honest-ish, ~30–36/day, calibrated.
  // Site 2: verified 27–32/day while billed ~40 — THE story.
  // Site 3: week 2, ~18–24/day, wider ranges (±10%), calibrating.
  for (let i = 59; i >= 0; i--) {
    const date = daysAgo(i);
    const c1 = makeDay(SITE_1, date, rand(30.5, 35.5), 1 + rand(0.4, 1.4), 'calibrated');
    const c2 = makeDay(SITE_2, date, rand(28.2, 31.4), 1 + rand(0.4, 1.4), 'calibrated');
    dailyCounts.push(c1, c2);
    if (i <= 12) {
      const base3 = rand(19, 23);
      const c3 = makeDay(SITE_3, date, base3, Math.max(2, base3 * 0.1), 'calibrating');
      dailyCounts.push(c3);
    }
  }
  for (const s of sites) {
    countsBySite.set(
      s.id,
      dailyCounts.filter((c) => c.siteId === s.id),
    );
  }

  const weekCountsFor = (siteId: string, weekStart: string): DailyCount[] => {
    const days = new Set(Array.from({ length: 7 }, (_, k) => addDays(weekStart, k)));
    return (countsBySite.get(siteId) ?? []).filter((c) => days.has(c.date));
  };

  /* bills + reconciliations */
  const bills: Bill[] = [];
  const reconciliations: Reconciliation[] = [];

  const pushReconciled = (siteId: string, weekStart: string, billed: number) => {
    const id = `bill-${siteId}-${weekStart}`;
    const bill: Bill = {
      id,
      siteId,
      weekStart,
      billedLabourDays: billed,
      amountInr: billed * DAILY_RATE_INR,
      submittedOn: addDays(weekStart, 7),
      status: 'reconciled',
    };
    bills.push(bill);
    const v = computeVariance(billed, weekCountsFor(siteId, weekStart));
    reconciliations.push({
      billId: id,
      siteId,
      weekStart,
      billedLabourDays: billed,
      verifiedMin: v.verifiedMin,
      verifiedMax: v.verifiedMax,
      variancePct: v.variancePct,
      flag: v.flag,
      savingsInr: v.savingsInr,
    });
  };

  // 7 reconciled weeks for sites 1 and 2; the most recent COMPLETED week
  // (w = 1) is left pending below so the reconciliation form has a full
  // 7-day verified window to reconcile against — never the in-progress week.
  for (let w = 8; w >= 2; w--) {
    const weekStart = addDays(currentMonday, -7 * w);

    const wk1 = weekCountsFor(SITE_1, weekStart);
    const midSum1 = wk1.reduce((s, c) => s + (c.verifiedMin + c.verifiedMax) / 2, 0);
    pushReconciled(SITE_1, weekStart, Math.round(midSum1 * rand(1.03, 1.05)));

    const wk2days = Array.from({ length: 7 }, (_, k) => addDays(weekStart, k));
    const billed2 = wk2days.reduce(
      (s, d) => s + (dayOfWeek(d) === 0 ? randInt(22, 26) : randInt(40, 42)),
      0,
    );
    pushReconciled(SITE_2, weekStart, billed2);
  }

  // Site 3: one completed (calibration) week, flagged for review.
  {
    const weekStart = addDays(currentMonday, -7);
    const wk3 = weekCountsFor(SITE_3, weekStart);
    if (wk3.length > 0) {
      const midSum3 = wk3.reduce((s, c) => s + (c.verifiedMin + c.verifiedMax) / 2, 0);
      pushReconciled(SITE_3, weekStart, Math.round(midSum3 * rand(1.06, 1.1)));
    }
  }

  // Last COMPLETED week: pending bills for sites 1 and 2 (the reconciliation
  // form's job). Reconciling the in-progress week would compare a full-week
  // contractor figure against only the elapsed days' verified counts.
  {
    const pendingWeek = addDays(currentMonday, -7);

    const wk1 = weekCountsFor(SITE_1, pendingWeek);
    const midSum1 = wk1.reduce((s, c) => s + (c.verifiedMin + c.verifiedMax) / 2, 0);
    bills.push({
      id: `bill-${SITE_1}-${pendingWeek}`,
      siteId: SITE_1,
      weekStart: pendingWeek,
      billedLabourDays: Math.round(midSum1 * 1.05),
      amountInr: Math.round(midSum1 * 1.05) * DAILY_RATE_INR,
      submittedOn: today,
      status: 'pending',
    });

    const wk2 = weekCountsFor(SITE_2, pendingWeek);
    const billed2 = wk2.reduce(
      (s, c) => s + (dayOfWeek(c.date) === 0 ? randInt(22, 26) : randInt(40, 42)),
      0,
    );
    bills.push({
      id: `bill-${SITE_2}-${pendingWeek}`,
      siteId: SITE_2,
      weekStart: pendingWeek,
      billedLabourDays: billed2,
      amountInr: billed2 * DAILY_RATE_INR,
      submittedOn: today,
      status: 'pending',
    });
  }

  /* alerts */
  const tamperResolvedDate = addDays(tamperDate, 1);
  const alerts: SiteAlert[] = [
    {
      id: 'al-gvr-tamper-1',
      siteId: SITE_2,
      cameraId: `${SITE_2}-gate-2`,
      type: 'tamper',
      openedIso: isoAt(tamperDate, '10:15'),
      resolvedIso: isoAt(tamperResolvedDate, '12:15'),
      note:
        'Gate cam 2 lens covered — 26 h no-footage window. Window billed at builder-verified headcount; event written to ledger as evidence.',
    },
    {
      id: 'al-lakeview-degraded-1',
      siteId: SITE_3,
      cameraId: `${SITE_3}-zone-a`,
      type: 'degraded',
      openedIso: isoAt(daysAgo(3), '08:40'),
      note:
        'Dust accumulation on zone cam A lens — image confidence below threshold. Cleaning visit scheduled; gate counts unaffected.',
    },
    {
      id: 'al-sunrise-power-1',
      siteId: SITE_1,
      cameraId: `${SITE_1}-solar-1`,
      type: 'power',
      openedIso: isoAt(daysAgo(21), '19:05'),
      resolvedIso: isoAt(daysAgo(20), '09:30'),
      note:
        'Solar mast battery low after two overcast days — camera ran reduced duty cycle overnight. Full charge restored by morning.',
    },
    {
      id: 'al-gvr-offline-1',
      siteId: SITE_2,
      cameraId: `${SITE_2}-zone-c`,
      type: 'offline',
      openedIso: isoAt(daysAgo(35), '14:20'),
      resolvedIso: isoAt(daysAgo(35), '17:05'),
      note:
        'Zone cam C offline 3 h — power cable disturbed near material hoist. Restored by site electrician.',
    },
    {
      id: 'al-lakeview-offline-1',
      siteId: SITE_3,
      cameraId: `${SITE_3}-gate-1`,
      type: 'offline',
      openedIso: isoAt(daysAgo(9), '11:10'),
      resolvedIso: isoAt(daysAgo(9), '16:25'),
      note:
        'Gate cam 1 offline 5 h during man-gate barricade adjustment. Counts for the window interpolated and marked low-confidence.',
    },
  ];

  /* ledger: per-site hash chain over daily counts (genesis -> today) */
  const ledger: LedgerEntry[] = [];
  for (const site of sites) {
    let prevHash = 'genesis';
    for (const count of countsBySite.get(site.id) ?? []) {
      const hash = computeLedgerHash(prevHash, count.date, count);
      let summary = `Verified ${count.verifiedMin}–${count.verifiedMax} · ${count.gateEntries} in / ${count.gateExits} out · peak ${count.peakOccupancy}`;
      if (site.id === SITE_2 && count.date === tamperDate) {
        summary +=
          ' · tamper: 26 h no-footage window billed at builder-verified headcount';
      }
      ledger.push({ siteId: site.id, date: count.date, hash, prevHash, summary });
      prevHash = hash;
    }
  }

  /* evidence clips */
  const clips: EvidenceClip[] = [
    // Sunrise Heights — routine verification texture.
    { id: 'clip-sun-1', siteId: SITE_1, date: daysAgo(4), cameraName: 'Gate cam 1', time: '08:02', label: 'Shift start — 33 entries in 12 min', durationSec: 35 },
    { id: 'clip-sun-2', siteId: SITE_1, date: daysAgo(7), cameraName: 'Zone cam A', time: '12:48', label: 'Lunch re-entry cluster', durationSec: 24 },
    { id: 'clip-sun-3', siteId: SITE_1, date: daysAgo(3), cameraName: 'Gate cam 2', time: '18:10', label: 'Exit count matched entries', durationSec: 20 },
    // GVR Meadows — tamper window + variance-day bursts.
    { id: 'clip-gvr-1', siteId: SITE_2, date: tamperDate, cameraName: 'Gate cam 2', time: '10:14', label: 'Lens covered — last frame before no-footage window', durationSec: 18 },
    { id: 'clip-gvr-2', siteId: SITE_2, date: tamperResolvedDate, cameraName: 'Gate cam 2', time: '12:18', label: 'Feed restored — lens cleared', durationSec: 22 },
    { id: 'clip-gvr-3', siteId: SITE_2, date: daysAgo(5), cameraName: 'Gate cam 1', time: '07:42', label: 'Burst of 14 entries', durationSec: 31 },
    { id: 'clip-gvr-4', siteId: SITE_2, date: daysAgo(6), cameraName: 'Gate cam 1', time: '17:55', label: 'Exit surge — 19 exits in 4 min', durationSec: 38 },
    { id: 'clip-gvr-5', siteId: SITE_2, date: daysAgo(8), cameraName: 'Zone cam B', time: '13:05', label: 'Headcount sample — 29 on slab', durationSec: 25 },
    { id: 'clip-gvr-6', siteId: SITE_2, date: daysAgo(13), cameraName: 'Gate cam 2', time: '07:58', label: 'Burst of 11 entries', durationSec: 27 },
    // Lakeview Residency — calibration samples.
    { id: 'clip-lake-1', siteId: SITE_3, date: daysAgo(2), cameraName: 'Gate cam 1', time: '08:21', label: 'Calibration sample — 21 entries', durationSec: 26 },
    { id: 'clip-lake-2', siteId: SITE_3, date: daysAgo(5), cameraName: 'Zone cam B', time: '11:34', label: 'Occupancy sample — 19 visible', durationSec: 22 },
    { id: 'clip-lake-3', siteId: SITE_3, date: daysAgo(1), cameraName: 'Gate cam 2', time: '17:46', label: 'Exit flow — 20 exits in 9 min', durationSec: 24 },
  ];

  /* ------------------------------------------------ stages (quality gates) */

  const STAGE_NAMES = [
    'Footing',
    'Plinth beam',
    'Ground-floor slab',
    'First-floor slab',
    'Brickwork GF',
    'Brickwork FF',
    'Internal plastering',
    'Flooring & tiles',
  ];

  const stageIdOf = (siteId: string, order: number) => `${siteId}-stage-${order}`;

  const stages: Stage[] = [];
  const makeStages = (
    siteId: string,
    inProgressOrder: number,
    verifiedDaysAgo: number[],
    gateNotes: Record<number, string> = {},
  ) => {
    STAGE_NAMES.forEach((name, idx) => {
      const order = idx + 1;
      const status: Stage['status'] =
        order < inProgressOrder
          ? 'verified'
          : order === inProgressOrder
            ? 'in-progress'
            : 'locked';
      stages.push({
        id: stageIdOf(siteId, order),
        siteId,
        name,
        order,
        status,
        ...(status === 'verified' ? { verifiedOn: daysAgo(verifiedDaysAgo[idx]) } : {}),
        ...(gateNotes[order] ? { gateNote: gateNotes[order] } : {}),
      });
    });
  };

  // Sunrise Heights: 1–4 verified across the past ~60 days, 5 in progress.
  makeStages(SITE_1, 5, [58, 43, 26, 9], {
    4: 'Slab cube test passed — 28-day strength report on file',
  });
  // GVR Meadows: 1–3 verified, 4 in progress; 5 locked behind the slab gate.
  makeStages(SITE_2, 4, [55, 38, 20], {
    5: 'Blocked — first-floor slab gate pending verification',
  });
  // Lakeview Residency: 1 verified, 2 in progress.
  makeStages(SITE_3, 2, [6]);

  /* ------------------------------------------------------------------ BOQ */

  interface BoqTemplate {
    description: string;
    category: BoqItem['category'];
    unit: string;
    rate: number;
    qty: number;
  }

  // Index 0..7 ↔ stage order 1..8. Rates are realistic Indian market rates.
  const BOQ_TEMPLATES: BoqTemplate[][] = [
    [
      { description: 'OPC 53-grade cement', category: 'cement', unit: 'bag', rate: 380, qty: 220 },
      { description: 'TMT steel Fe-550, 12 mm', category: 'steel', unit: 'kg', rate: 62, qty: 2800 },
      { description: 'River sand', category: 'sand', unit: 'cft', rate: 45, qty: 900 },
      { description: 'Coarse aggregate 20 mm', category: 'aggregate', unit: 'cft', rate: 38, qty: 1200 },
      { description: 'Shuttering plywood + props', category: 'shuttering', unit: 'sqft', rate: 55, qty: 600 },
    ],
    [
      { description: 'OPC 53-grade cement', category: 'cement', unit: 'bag', rate: 380, qty: 140 },
      { description: 'TMT steel Fe-550, 10 mm', category: 'steel', unit: 'kg', rate: 62, qty: 1900 },
      { description: 'River sand', category: 'sand', unit: 'cft', rate: 45, qty: 520 },
      { description: 'Coarse aggregate 20 mm', category: 'aggregate', unit: 'cft', rate: 38, qty: 700 },
      { description: 'Beam shuttering + props', category: 'shuttering', unit: 'sqft', rate: 55, qty: 480 },
    ],
    [
      { description: 'OPC 53-grade cement', category: 'cement', unit: 'bag', rate: 380, qty: 310 },
      { description: 'TMT steel Fe-550, 8/10/12 mm', category: 'steel', unit: 'kg', rate: 62, qty: 3600 },
      { description: 'River sand', category: 'sand', unit: 'cft', rate: 45, qty: 760 },
      { description: 'Coarse aggregate 20 mm', category: 'aggregate', unit: 'cft', rate: 38, qty: 1050 },
      { description: 'Slab shuttering plates + jacks', category: 'shuttering', unit: 'sqft', rate: 55, qty: 1450 },
      { description: 'PVC conduit 25 mm, in-slab', category: 'electrical', unit: 'm', rate: 48, qty: 350 },
    ],
    [
      { description: 'OPC 53-grade cement', category: 'cement', unit: 'bag', rate: 380, qty: 290 },
      { description: 'TMT steel Fe-550, 8/10/12 mm', category: 'steel', unit: 'kg', rate: 62, qty: 3400 },
      { description: 'River sand', category: 'sand', unit: 'cft', rate: 45, qty: 720 },
      { description: 'Coarse aggregate 20 mm', category: 'aggregate', unit: 'cft', rate: 38, qty: 980 },
      { description: 'Slab shuttering plates + jacks', category: 'shuttering', unit: 'sqft', rate: 55, qty: 1450 },
      { description: 'PVC conduit 25 mm, in-slab', category: 'electrical', unit: 'm', rate: 48, qty: 330 },
    ],
    [
      { description: 'Red clay bricks, 9 in', category: 'bricks', unit: 'no', rate: 8, qty: 18000 },
      { description: 'OPC 53-grade cement (mortar)', category: 'cement', unit: 'bag', rate: 380, qty: 95 },
      { description: 'River sand (mortar)', category: 'sand', unit: 'cft', rate: 45, qty: 620 },
      { description: 'CPVC sleeves & wall pipes', category: 'plumbing', unit: 'm', rate: 140, qty: 60 },
    ],
    [
      { description: 'Red clay bricks, 9 in', category: 'bricks', unit: 'no', rate: 8, qty: 16500 },
      { description: 'OPC 53-grade cement (mortar)', category: 'cement', unit: 'bag', rate: 380, qty: 85 },
      { description: 'River sand (mortar)', category: 'sand', unit: 'cft', rate: 45, qty: 560 },
      { description: 'Modular switch boxes + conduit', category: 'electrical', unit: 'no', rate: 85, qty: 120 },
    ],
    [
      { description: 'OPC 53-grade cement (plaster)', category: 'cement', unit: 'bag', rate: 380, qty: 180 },
      { description: 'Plaster sand, fine', category: 'sand', unit: 'cft', rate: 45, qty: 1400 },
      { description: 'Wiring conduit in chase', category: 'electrical', unit: 'm', rate: 48, qty: 280 },
      { description: 'Concealed CPVC lines', category: 'plumbing', unit: 'm', rate: 140, qty: 180 },
    ],
    [
      { description: 'Vitrified tiles 600×600', category: 'tiles', unit: 'sqft', rate: 65, qty: 2400 },
      { description: 'OPC 53-grade cement (bedding)', category: 'cement', unit: 'bag', rate: 380, qty: 70 },
      { description: 'Screed sand', category: 'sand', unit: 'cft', rate: 45, qty: 380 },
      { description: 'Interior emulsion paint', category: 'paint', unit: 'litre', rate: 310, qty: 220 },
    ],
  ];

  // Built-up-area scale per site (GVR is the largest block, Lakeview smallest).
  const SITE_SCALE: Record<string, number> = {
    [SITE_1]: 1.0,
    [SITE_2]: 1.2,
    [SITE_3]: 0.75,
  };

  const roundQty = (q: number): number => {
    if (q >= 10000) return Math.round(q / 500) * 500;
    if (q >= 1000) return Math.round(q / 50) * 50;
    if (q >= 100) return Math.round(q / 10) * 10;
    return Math.max(5, Math.round(q / 5) * 5);
  };

  const boqItems: BoqItem[] = [];
  for (const site of sites) {
    const scale = SITE_SCALE[site.id];
    BOQ_TEMPLATES.forEach((templates, stageIdx) => {
      const sid = stageIdOf(site.id, stageIdx + 1);
      templates.forEach((t, itemIdx) => {
        boqItems.push({
          id: `${sid}-boq-${itemIdx + 1}`,
          siteId: site.id,
          stageId: sid,
          description: t.description,
          category: t.category,
          qty: roundQty(t.qty * scale * rand(0.94, 1.08)),
          unit: t.unit,
          ratePerUnit: t.rate,
        });
      });
    });
  }

  /* -------------------------------------------------------------- vendors */

  const ALL_CATEGORIES: Vendor['categories'] = [
    'cement', 'steel', 'bricks', 'sand', 'aggregate',
    'shuttering', 'electrical', 'plumbing', 'tiles', 'paint',
  ];

  const vendors: Vendor[] = [
    {
      id: 'sri-balaji-traders',
      name: 'Sri Balaji Traders',
      city: 'Hyderabad',
      categories: ['cement', 'sand', 'aggregate'],
      rating: 4.6,
      deliveryDays: 1,
      priceFactor: 1.0,
      gstin: '36AABCS4821F1Z5',
      paymentTerms: '50% advance, balance on delivery',
    },
    {
      id: 'deccan-cement-agencies',
      name: 'Deccan Cement Agencies',
      city: 'Hyderabad',
      categories: ['cement'],
      rating: 4.4,
      deliveryDays: 2,
      priceFactor: 0.96,
      gstin: '36AADCD7390G1Z3',
      paymentTerms: '100% advance',
    },
    {
      id: 'knr-steel-hardware',
      name: 'KNR Steel & Hardware',
      city: 'Hyderabad',
      categories: ['steel', 'shuttering'],
      rating: 4.7,
      deliveryDays: 2,
      priceFactor: 1.02,
      gstin: '36AAFCK1265H1Z8',
      paymentTerms: '15-day credit',
    },
    {
      id: 'metro-buildmart',
      name: 'Metro BuildMart',
      city: 'Hyderabad',
      categories: ALL_CATEGORIES,
      rating: 4.2,
      deliveryDays: 3,
      priceFactor: 0.94,
      gstin: '36AAGCM5847J1Z2',
      paymentTerms: '30% advance, balance 15-day credit',
    },
    {
      id: 'warangal-building-supplies',
      name: 'Warangal Building Supplies',
      city: 'Warangal',
      categories: ALL_CATEGORIES,
      rating: 4.3,
      deliveryDays: 1,
      priceFactor: 1.04,
      gstin: '36AAHCW9034K1Z6',
      paymentTerms: 'Cash on delivery',
    },
  ];

  /* --------------------------------------------------------------- orders */

  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const orders: MaterialOrder[] = [];
  let orderSeq = 0;

  // picks: BOQ template index within the stage → fraction of BOQ qty ordered.
  const seedOrder = (
    siteId: string,
    stageOrder: number,
    vendorId: string,
    picks: Array<{ idx: number; frac: number }>,
    placedDaysAgo: number,
  ) => {
    const sid = stageIdOf(siteId, stageOrder);
    const vendor = vendorById.get(vendorId);
    if (!vendor) return;
    const stageItems = boqItems.filter((b) => b.stageId === sid);
    const lines: OrderLine[] = [];
    for (const pick of picks) {
      const item = stageItems[pick.idx];
      if (!item) continue;
      const qty = Math.max(1, Math.round(item.qty * pick.frac));
      const ratePerUnit = Math.round(item.ratePerUnit * vendor.priceFactor);
      lines.push({
        boqItemId: item.id,
        description: item.description,
        qty,
        unit: item.unit,
        ratePerUnit,
        lineTotal: qty * ratePerUnit,
      });
    }
    const subtotalInr = lines.reduce((s, l) => s + l.lineTotal, 0);
    const placedOn = daysAgo(placedDaysAgo);
    const etaDate = addDays(placedOn, vendor.deliveryDays);
    orderSeq += 1;
    orders.push({
      id: `ord-${String(orderSeq).padStart(3, '0')}`,
      siteId,
      stageId: sid,
      vendorId,
      lines,
      subtotalInr,
      gstPct: 18,
      totalInr: Math.round(subtotalInr * 1.18),
      status: etaDate < today ? 'delivered' : 'placed',
      placedOn,
      etaDate,
    });
  };

  // Sunrise Heights — delivered history on verified stages…
  seedOrder(SITE_1, 1, 'sri-balaji-traders', [
    { idx: 0, frac: 1 }, { idx: 2, frac: 1 }, { idx: 3, frac: 1 },
  ], 70);
  seedOrder(SITE_1, 3, 'knr-steel-hardware', [
    { idx: 1, frac: 1 }, { idx: 4, frac: 1 },
  ], 34);
  // …and ~50% of bricks + cement already in for the in-progress Brickwork GF.
  seedOrder(SITE_1, 5, 'metro-buildmart', [
    { idx: 0, frac: 0.5 }, { idx: 1, frac: 0.55 },
  ], 6);

  // GVR Meadows — delivered history…
  seedOrder(SITE_2, 1, 'deccan-cement-agencies', [{ idx: 0, frac: 1 }], 64);
  seedOrder(SITE_2, 2, 'sri-balaji-traders', [
    { idx: 0, frac: 1 }, { idx: 2, frac: 1 }, { idx: 3, frac: 1 },
  ], 47);
  // …in-progress First-floor slab: 60% cement delivered, 45% steel en route.
  seedOrder(SITE_2, 4, 'deccan-cement-agencies', [{ idx: 0, frac: 0.6 }], 4);
  seedOrder(SITE_2, 4, 'knr-steel-hardware', [
    { idx: 1, frac: 0.45 }, { idx: 4, frac: 0.4 },
  ], 1);

  // Lakeview Residency — footing delivered, plinth partially ordered today.
  seedOrder(SITE_3, 1, 'warangal-building-supplies', [
    { idx: 0, frac: 1 }, { idx: 1, frac: 1 }, { idx: 2, frac: 1 },
  ], 11);
  seedOrder(SITE_3, 2, 'warangal-building-supplies', [
    { idx: 0, frac: 0.4 }, { idx: 1, frac: 0.5 },
  ], 0);

  return {
    seedVersion: SEED_VERSION,
    sites,
    cameras,
    dailyCounts,
    bills,
    reconciliations,
    alerts,
    ledger,
    clips,
    stages,
    boqItems,
    vendors,
    orders,
  };
}
