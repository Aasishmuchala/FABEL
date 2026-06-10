export type SiteStatus = 'calibrated' | 'calibrating';
export type CameraKind = 'gate' | 'zone' | 'solar';
export type CameraStatus = 'online' | 'offline' | 'degraded';
export type Confidence = 'calibrated' | 'calibrating';
export type BillStatus = 'pending' | 'reconciled';
export type ReconciliationFlag = 'ok' | 'review' | 'variance';
export type AlertType = 'offline' | 'tamper' | 'degraded' | 'power';

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

export interface Db {
  sites: Site[];
  cameras: Camera[];
  dailyCounts: DailyCount[];
  bills: Bill[];
  reconciliations: Reconciliation[];
  alerts: SiteAlert[];
  ledger: LedgerEntry[];
  clips: EvidenceClip[];
}
