export type SiteStatus = 'calibrated' | 'calibrating';
export type StageStatus = 'verified' | 'in-progress' | 'locked';
export type MaterialCategory =
  | 'cement'
  | 'steel'
  | 'bricks'
  | 'sand'
  | 'aggregate'
  | 'shuttering'
  | 'electrical'
  | 'plumbing'
  | 'tiles'
  | 'paint';
export type MaterialOrderStatus = 'placed' | 'delivered';
export type CameraKind = 'gate' | 'zone' | 'solar';
export type CameraStatus = 'online' | 'offline' | 'degraded';
export type Confidence = 'calibrated' | 'calibrating';
export type BillStatus = 'pending' | 'reconciled';
export type ReconciliationFlag = 'ok' | 'review' | 'variance';
export type AlertType = 'offline' | 'tamper' | 'degraded' | 'power';
/** How site evidence is captured for a stage. */
export type CaptureMethod = 'fixed-cams' | 'walk-360' | 'gate-sweep' | 'laser-tls';

export interface Site {
  id: string;
  name: string;
  city: string;
  contractor: string;
  status: SiteStatus;
  gateChannelled: boolean;
  startedOn: string;
  tagline?: string;
}

export interface Camera {
  id: string;
  siteId: string;
  name: string;
  kind: CameraKind;
  status: CameraStatus;
  lastSeenIso: string;
}

export interface DailyCount {
  siteId: string;
  date: string;
  verifiedMin: number;
  verifiedMax: number;
  gateEntries: number;
  gateExits: number;
  peakOccupancy: number;
  samples: number;
  confidence: Confidence;
}

export interface Bill {
  id: string;
  siteId: string;
  weekStart: string;
  billedLabourDays: number;
  amountInr: number;
  submittedOn: string;
  status: BillStatus;
}

export interface Reconciliation {
  billId: string;
  siteId: string;
  weekStart: string;
  billedLabourDays: number;
  verifiedMin: number;
  verifiedMax: number;
  variancePct: number;
  flag: ReconciliationFlag;
  savingsInr: number;
}

export interface SiteAlert {
  id: string;
  siteId: string;
  cameraId?: string;
  type: AlertType;
  openedIso: string;
  resolvedIso?: string;
  note: string;
}

export interface LedgerEntry {
  siteId: string;
  date: string;
  hash: string;
  prevHash: string;
  summary: string;
}

export interface EvidenceClip {
  id: string;
  siteId: string;
  date: string;
  cameraName: string;
  time: string;
  label: string;
  durationSec: number;
}

/** One line of a stage's concealment-gate checklist. */
export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Construction stage with a quality gate; materials unlock stage-by-stage. */
export interface Stage {
  id: string;
  siteId: string;
  name: string;
  /** 1-based position in the build sequence (1–14). */
  order: number;
  status: StageStatus;
  /** Date (YYYY-MM-DD) the quality gate passed; only on 'verified' stages. */
  verifiedOn?: string;
  gateNote?: string;
  /** 0–100. Verified stages are always 100, locked stages 0. */
  progressPct: number;
  /** Capture methods used to verify this stage's work. */
  captureMethods: CaptureMethod[];
  /** ISO timestamp of the latest capture; set on verified + in-progress stages. */
  lastCaptureAt?: string;
  /** Concealment-gate checklist; empty array for far-future stages. */
  checklist: ChecklistItem[];
  /** Deviations flagged against this stage that are still open. */
  openDeviations: number;
}

/** Bill-of-quantities line budgeted for one stage of one site. */
export interface BoqItem {
  id: string;
  siteId: string;
  stageId: string;
  description: string;
  category: MaterialCategory;
  qty: number;
  unit: string;
  /** Budget rate in ₹ per unit (vendor priceFactor applies on order). */
  ratePerUnit: number;
}

export interface Vendor {
  id: string;
  name: string;
  city: string;
  categories: MaterialCategory[];
  /** Out of 5, e.g. 4.6 */
  rating: number;
  deliveryDays: number;
  /** Multiplier on BOQ rate, e.g. 0.96 = 4% below budget. */
  priceFactor: number;
  gstin: string;
  paymentTerms: string;
}

export interface OrderLine {
  boqItemId: string;
  description: string;
  qty: number;
  unit: string;
  /** ₹/unit actually paid = round(boq rate × vendor priceFactor). */
  ratePerUnit: number;
  lineTotal: number;
}

export interface MaterialOrder {
  id: string;
  siteId: string;
  stageId: string;
  vendorId: string;
  lines: OrderLine[];
  subtotalInr: number;
  gstPct: 18;
  totalInr: number;
  status: MaterialOrderStatus;
  placedOn: string;
  etaDate: string;
}

export interface Db {
  /** Bumped when the seed shape changes; older db.json files regenerate. */
  seedVersion: number;
  sites: Site[];
  cameras: Camera[];
  dailyCounts: DailyCount[];
  bills: Bill[];
  reconciliations: Reconciliation[];
  alerts: SiteAlert[];
  ledger: LedgerEntry[];
  clips: EvidenceClip[];
  stages: Stage[];
  boqItems: BoqItem[];
  vendors: Vendor[];
  orders: MaterialOrder[];
}
