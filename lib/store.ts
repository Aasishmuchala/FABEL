import fs from 'node:fs';
import path from 'node:path';
import {
  addDays,
  computeLedgerHash,
  computeVariance,
  generateSeed,
  todayStr,
  DAILY_RATE_INR,
  SEED_VERSION,
} from './seed';
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
  Site,
  SiteAlert,
  Stage,
  Vendor,
} from './types';

export { DAILY_RATE_INR, SEED_VERSION, computeVariance, mondayOf } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function reseed(): Db {
  const seeded = generateSeed();
  writeDb(seeded);
  return seeded;
}

function readDb(): Db {
  if (!fs.existsSync(DB_FILE)) {
    return reseed();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Db;
    // Shape changed since this file was written (or it predates versioning):
    // regenerate rather than serving a db missing whole collections.
    if (parsed.seedVersion !== SEED_VERSION) {
      return reseed();
    }
    return parsed;
  } catch {
    // A truncated or corrupt db.json (e.g. process killed mid-write) must not
    // 500 every request forever — fall back to a fresh seed.
    return reseed();
  }
}

/**
 * Atomic persist: write to a temp file in the same directory, then rename over
 * db.json so readers never observe a partially written file.
 *
 * Note on concurrency: both mutators below are fully synchronous (no await
 * between read, mutate and write), so Node's run-to-completion semantics
 * already serialize them within a process; the atomic rename guards against
 * crashes and cross-process readers.
 */
function writeDb(db: Db): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = path.join(
    DATA_DIR,
    `db.json.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

/* ------------------------------------------------------------- getters */

export function getSites(): Site[] {
  return readDb().sites;
}

export function getSite(id: string): Site | undefined {
  return readDb().sites.find((s) => s.id === id);
}

export function getCameras(siteId: string): Camera[] {
  return readDb().cameras.filter((c) => c.siteId === siteId);
}

/** Daily counts for a site, oldest → newest. */
export function getDailyCounts(siteId: string): DailyCount[] {
  return readDb()
    .dailyCounts.filter((c) => c.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Most recent daily count for a site (usually today). */
export function getLatestDailyCount(siteId: string): DailyCount | undefined {
  const counts = getDailyCounts(siteId);
  return counts[counts.length - 1];
}

/** Bills, newest week first. Omit siteId for all sites. */
export function getBills(siteId?: string): Bill[] {
  return readDb()
    .bills.filter((b) => !siteId || b.siteId === siteId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** Reconciliations, newest week first. Omit siteId for all sites. */
export function getReconciliations(siteId?: string): Reconciliation[] {
  return readDb()
    .reconciliations.filter((r) => !siteId || r.siteId === siteId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

/** Alerts, newest first; open alerts before resolved. Omit siteId for all sites. */
export function getAlerts(siteId?: string): SiteAlert[] {
  return readDb()
    .alerts.filter((a) => !siteId || a.siteId === siteId)
    .sort((a, b) => {
      const openA = a.resolvedIso ? 1 : 0;
      const openB = b.resolvedIso ? 1 : 0;
      if (openA !== openB) return openA - openB;
      return b.openedIso.localeCompare(a.openedIso);
    });
}

/** Hash-chained ledger entries for a site, oldest → newest. */
export function getLedger(siteId: string): LedgerEntry[] {
  return readDb()
    .ledger.filter((l) => l.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Evidence clips for a site, newest date first. */
export function getClips(siteId: string): EvidenceClip[] {
  return readDb()
    .clips.filter((c) => c.siteId === siteId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Chain status: 'empty' is a brand-new site with no entries yet — NOT a
 * failure; only a hash mismatch on existing entries is 'failed'.
 */
export type LedgerChainStatus = 'verified' | 'failed' | 'empty';

/** Recompute the chain from genesis and compare every hash. */
export function verifyLedger(siteId: string): LedgerChainStatus {
  const db = readDb();
  const entries = db.ledger
    .filter((l) => l.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return 'empty';
  const counts = new Map(
    db.dailyCounts.filter((c) => c.siteId === siteId).map((c) => [c.date, c]),
  );
  let prevHash = 'genesis';
  for (const entry of entries) {
    const count = counts.get(entry.date);
    if (!count) return 'failed';
    if (entry.prevHash !== prevHash) return 'failed';
    if (entry.hash !== computeLedgerHash(prevHash, entry.date, count)) return 'failed';
    prevHash = entry.hash;
  }
  return 'verified';
}

/* -------------------------------------------------- portfolio aggregate */

export interface PortfolioSummary {
  totalSites: number;
  camerasOnline: number;
  camerasTotal: number;
  openAlerts: number;
  /** Sum of today's verified ranges across sites with a count for today. */
  todayVerifiedMin: number;
  todayVerifiedMax: number;
  pendingBills: number;
  /** Verified savings over reconciliations in the last ~30 days. */
  savingsLast30dInr: number;
  /** All-time verified savings across all reconciliations. */
  totalSavingsInr: number;
}

export function getPortfolioSummary(): PortfolioSummary {
  const db = readDb();
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

  const todays = db.dailyCounts.filter((c) => c.date === today);
  return {
    totalSites: db.sites.length,
    camerasOnline: db.cameras.filter((c) => c.status === 'online').length,
    camerasTotal: db.cameras.length,
    openAlerts: db.alerts.filter((a) => !a.resolvedIso).length,
    todayVerifiedMin: todays.reduce((s, c) => s + c.verifiedMin, 0),
    todayVerifiedMax: todays.reduce((s, c) => s + c.verifiedMax, 0),
    pendingBills: db.bills.filter((b) => b.status === 'pending').length,
    savingsLast30dInr: db.reconciliations
      .filter((r) => r.weekStart >= cutoffStr)
      .reduce((s, r) => s + r.savingsInr, 0),
    totalSavingsInr: db.reconciliations.reduce((s, r) => s + r.savingsInr, 0),
  };
}

/* ------------------------------------------------------------ mutators */

export interface SubmitBillInput {
  siteId: string;
  weekStart: string;
  billedLabourDays: number;
  /** Defaults to billedLabourDays × ₹650. */
  amountInr?: number;
}

/**
 * Creates (or replaces the pending) bill for the site + week, reconciles it
 * against that week's daily counts, persists, and returns both records.
 */
export function submitBill(input: SubmitBillInput): {
  bill: Bill;
  reconciliation: Reconciliation;
} {
  const db = readDb();
  const { siteId, weekStart, billedLabourDays } = input;
  const amountInr = input.amountInr ?? billedLabourDays * DAILY_RATE_INR;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const weekDates = new Set<string>();
  {
    const [y, m, d] = weekStart.split('-').map(Number);
    for (let k = 0; k < 7; k++) {
      const dt = new Date(y, m - 1, d + k, 12);
      weekDates.add(
        `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
      );
    }
  }
  const weekCounts = db.dailyCounts.filter(
    (c) => c.siteId === siteId && weekDates.has(c.date),
  );
  const v = computeVariance(billedLabourDays, weekCounts);

  let bill = db.bills.find(
    (b) => b.siteId === siteId && b.weekStart === weekStart,
  );
  if (bill) {
    bill.billedLabourDays = billedLabourDays;
    bill.amountInr = amountInr;
    bill.submittedOn = today;
    bill.status = 'reconciled';
  } else {
    bill = {
      id: `bill-${siteId}-${weekStart}`,
      siteId,
      weekStart,
      billedLabourDays,
      amountInr,
      submittedOn: today,
      status: 'reconciled',
    };
    db.bills.push(bill);
  }

  const reconciliation: Reconciliation = {
    billId: bill.id,
    siteId,
    weekStart,
    billedLabourDays,
    verifiedMin: v.verifiedMin,
    verifiedMax: v.verifiedMax,
    variancePct: v.variancePct,
    flag: v.flag,
    savingsInr: v.savingsInr,
  };
  db.reconciliations = db.reconciliations.filter((r) => r.billId !== bill.id);
  db.reconciliations.push(reconciliation);

  writeDb(db);
  return { bill, reconciliation };
}

/** Marks an alert resolved now (optionally replacing its note). Returns it, or undefined if not found. */
export function resolveAlert(alertId: string, note?: string): SiteAlert | undefined {
  const db = readDb();
  const alert = db.alerts.find((a) => a.id === alertId);
  if (!alert) return undefined;
  if (!alert.resolvedIso) {
    alert.resolvedIso = new Date().toISOString();
  }
  if (note) {
    alert.note = note;
  }
  writeDb(db);
  return alert;
}

/* ------------------------------------------- procurement (quality-gated) */

/** Stages for a site in build order (1 → 8). */
export function getStages(siteId: string): Stage[] {
  return readDb()
    .stages.filter((s) => s.siteId === siteId)
    .sort((a, b) => a.order - b.order);
}

/** BOQ items for a site, optionally narrowed to one stage; in stage/BOQ order. */
export function getBoq(siteId: string, stageId?: string): BoqItem[] {
  return readDb().boqItems.filter(
    (b) => b.siteId === siteId && (!stageId || b.stageId === stageId),
  );
}

/** Vendors (highest rated first), optionally only those carrying a category. */
export function getVendors(category?: string): Vendor[] {
  return readDb()
    .vendors.filter(
      (v) => !category || (v.categories as string[]).includes(category),
    )
    .sort((a, b) => b.rating - a.rating);
}

/** Material orders, newest placed first. Omit siteId for all sites. */
export function getOrders(siteId?: string): MaterialOrder[] {
  return readDb()
    .orders.filter((o) => !siteId || o.siteId === siteId)
    .sort(
      (a, b) => b.placedOn.localeCompare(a.placedOn) || b.id.localeCompare(a.id),
    );
}

/** Total quantity already ordered against a BOQ item (placed + delivered). */
export function getOrderedQty(boqItemId: string): number {
  let sum = 0;
  for (const order of readDb().orders) {
    for (const line of order.lines) {
      if (line.boqItemId === boqItemId) sum += line.qty;
    }
  }
  return sum;
}

export interface PlaceOrderInput {
  siteId: string;
  stageId: string;
  vendorId: string;
  lines: Array<{ boqItemId: string; qty: number }>;
}

export type PlaceOrderResult =
  | { ok: true; order: MaterialOrder }
  | { ok: false; error: string };

/**
 * Places a material order against the BOQ of an in-progress stage.
 *
 * Quality gate: ordering on a 'locked' stage is refused (previous stage not
 * yet verified) and 'verified' stages are closed for materials. Quantities
 * are capped at the BOQ remainder (BOQ qty − already ordered). Line rates are
 * the BOQ rate × vendor priceFactor, rounded to whole rupees; 18% GST applies.
 */
export function placeOrder(input: PlaceOrderInput): PlaceOrderResult {
  const db = readDb();

  const site = db.sites.find((s) => s.id === input.siteId);
  if (!site) return { ok: false, error: 'Site not found' };

  const stage = db.stages.find(
    (s) => s.id === input.stageId && s.siteId === input.siteId,
  );
  if (!stage) return { ok: false, error: 'Stage not found for this site' };

  const vendor = db.vendors.find((v) => v.id === input.vendorId);
  if (!vendor) return { ok: false, error: 'Vendor not found' };

  if (stage.status === 'locked') {
    return { ok: false, error: 'Quality gate: previous stage not yet verified' };
  }
  if (stage.status === 'verified') {
    return { ok: false, error: 'Stage already verified — materials closed' };
  }

  if (input.lines.length === 0) {
    return { ok: false, error: 'Order needs at least one line' };
  }

  // Already-ordered quantity per BOQ item; also accumulates the lines of THIS
  // order so duplicate boqItemIds in the input cannot bypass the remainder cap.
  const ordered = new Map<string, number>();
  for (const order of db.orders) {
    for (const line of order.lines) {
      ordered.set(line.boqItemId, (ordered.get(line.boqItemId) ?? 0) + line.qty);
    }
  }

  const lines: OrderLine[] = [];
  for (const req of input.lines) {
    const item = db.boqItems.find((b) => b.id === req.boqItemId);
    if (!item || item.stageId !== stage.id) {
      return { ok: false, error: 'BOQ item does not belong to this stage' };
    }
    if (!Number.isFinite(req.qty) || req.qty <= 0) {
      return { ok: false, error: `Quantity must be above zero for ${item.description}` };
    }
    const remaining = item.qty - (ordered.get(item.id) ?? 0);
    if (req.qty > remaining) {
      return {
        ok: false,
        error: `Only ${Math.max(0, remaining)} ${item.unit} of ${item.description} left in BOQ`,
      };
    }
    ordered.set(item.id, (ordered.get(item.id) ?? 0) + req.qty);

    const ratePerUnit = Math.round(item.ratePerUnit * vendor.priceFactor);
    lines.push({
      boqItemId: item.id,
      description: item.description,
      qty: req.qty,
      unit: item.unit,
      ratePerUnit,
      lineTotal: Math.round(req.qty * ratePerUnit),
    });
  }

  const subtotalInr = lines.reduce((s, l) => s + l.lineTotal, 0);
  const today = todayStr();
  const order: MaterialOrder = {
    id: `ord-${Date.now().toString(36)}-${db.orders.length + 1}`,
    siteId: input.siteId,
    stageId: input.stageId,
    vendorId: input.vendorId,
    lines,
    subtotalInr,
    gstPct: 18,
    totalInr: Math.round(subtotalInr * 1.18),
    status: 'placed',
    placedOn: today,
    etaDate: addDays(today, vendor.deliveryDays),
  };

  db.orders.push(order);
  writeDb(db);
  return { ok: true, order };
}
