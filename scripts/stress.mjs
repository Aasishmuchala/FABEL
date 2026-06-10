#!/usr/bin/env node
/**
 * Haazri stress / abuse harness — permanent regression tool.
 *
 * Usage:  node scripts/stress.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:4123
 *
 * Requires Node >= 18 (global fetch). No dependencies.
 *
 * Groups:
 *   A. Ingest fuzz       — malformed/missing/wrong-type/negative/oversized/unknown-site
 *                          payloads must 4xx (never 5xx); one valid payload must 200.
 *   B. Evidence API      — real billId (read from data/db.json) → 200 + chainVerified;
 *                          garbage billId → 404/400, never 500.
 *   C. Routes under abuse— garbage ids, encoded <script> paths, nonsense query params:
 *                          200 or 404 only, and no raw XSS echo in bodies.
 *   D. Concurrency       — 12 parallel valid POSTs per ingest endpoint, all non-5xx.
 *   E. Corruption        — overwrite data/db.json with garbage while the server runs;
 *                          GET / must still 200 (store re-seeds). File deleted after.
 *
 * Exit code: 0 if everything passed, 1 otherwise.
 * Final line is always:  STRESS: <pass>/<total> passed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = (process.argv[2] || 'http://localhost:4123').replace(/\/+$/, '');
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_FILE = path.join(REPO_ROOT, 'data', 'db.json');

let pass = 0;
let fail = 0;

function record(ok, group, name, detail) {
  if (ok) {
    pass += 1;
    console.log(`PASS [${group}] ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL [${group}] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** fetch that never throws — network errors count as status 0. */
async function hit(pathname, init) {
  try {
    const res = await fetch(`${BASE_URL}${pathname}`, { redirect: 'manual', ...init });
    const body = await res.text();
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}

function postJsonInit(value) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  };
}

const is4xx = (s) => s >= 400 && s < 500;
const is5xx = (s) => s >= 500 || s === 0;

/* ------------------------------------------------------------------ */
/* Group A — ingest fuzz                                               */
/* ------------------------------------------------------------------ */

const VALID = {
  counts: {
    siteId: 'sunrise-heights',
    date: '2026-06-09',
    gateEntries: 42,
    gateExits: 40,
    occupancySamples: [10, 25, 38, 41, 35, 12],
  },
  events: {
    siteId: 'sunrise-heights',
    cameraId: 'cam-stress-1',
    type: 'offline',
    atIso: '2026-06-09T08:30:00.000Z',
    note: 'stress harness synthetic event',
  },
  heartbeat: {
    siteId: 'sunrise-heights',
    deviceId: 'edge-stress-1',
    atIso: '2026-06-09T08:31:00.000Z',
    camerasOnline: 3,
  },
};

function fuzzCasesFor(endpoint) {
  const valid = VALID[endpoint];
  const cases = [
    { name: 'malformed JSON body', init: postJsonInit('{"siteId": "sunrise-heights",') },
    { name: 'empty body', init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '' } },
    { name: 'missing fields ({})', init: postJsonInit({}) },
    { name: 'null body', init: postJsonInit('null') },
    { name: 'array body', init: postJsonInit('[1,2,3]') },
    { name: 'unknown siteId', init: postJsonInit({ ...valid, siteId: 'no-such-site-xyz' }) },
  ];
  if (endpoint === 'counts') {
    cases.push(
      { name: 'wrong types (string counts)', init: postJsonInit({ ...valid, gateEntries: '42', gateExits: '40' }) },
      { name: 'negative numbers', init: postJsonInit({ ...valid, gateEntries: -5 }) },
      { name: 'negative occupancy sample', init: postJsonInit({ ...valid, occupancySamples: [10, -3] }) },
      { name: 'NaN-ish counts (string "NaN")', init: postJsonInit({ ...valid, gateEntries: 'NaN' }) },
      { name: 'absurd 10k occupancySamples array', init: postJsonInit({ ...valid, occupancySamples: Array.from({ length: 10000 }, (_, i) => i % 50) }) },
      { name: 'occupancySamples of strings', init: postJsonInit({ ...valid, occupancySamples: ['a', 'b'] }) },
      { name: 'bad date format', init: postJsonInit({ ...valid, date: '09-06-2026' }) },
    );
  }
  if (endpoint === 'events') {
    cases.push(
      { name: 'wrong type enum', init: postJsonInit({ ...valid, type: 'exploded' }) },
      { name: 'numeric cameraId (wrong type)', init: postJsonInit({ ...valid, cameraId: 12345 }) },
      { name: 'garbage atIso', init: postJsonInit({ ...valid, atIso: 'not-a-date' }) },
    );
  }
  if (endpoint === 'heartbeat') {
    cases.push(
      { name: 'string camerasOnline (wrong type)', init: postJsonInit({ ...valid, camerasOnline: '3' }) },
      { name: 'negative camerasOnline', init: postJsonInit({ ...valid, camerasOnline: -1 }) },
      { name: 'fractional camerasOnline', init: postJsonInit({ ...valid, camerasOnline: 2.5 }) },
      { name: 'garbage atIso', init: postJsonInit({ ...valid, atIso: 'whenever' }) },
    );
  }
  return cases;
}

async function groupIngestFuzz() {
  for (const endpoint of ['counts', 'events', 'heartbeat']) {
    const url = `/api/ingest/${endpoint}`;
    for (const c of fuzzCasesFor(endpoint)) {
      const { status } = await hit(url, c.init);
      record(is4xx(status), 'A:ingest-fuzz', `${endpoint}: ${c.name} → ${status}`, `expected 4xx, got ${status}`);
    }
    const { status, body } = await hit(url, postJsonInit(VALID[endpoint]));
    record(status === 200, 'A:ingest-fuzz', `${endpoint}: valid payload → ${status}`, `expected 200, got ${status}: ${body.slice(0, 120)}`);
  }
}

/* ------------------------------------------------------------------ */
/* Group B — evidence API                                              */
/* ------------------------------------------------------------------ */

async function groupEvidence() {
  let billId = null;
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    billId = db.bills?.[0]?.id ?? null;
  } catch {
    /* fall through — handled below */
  }
  if (!billId) {
    record(false, 'B:evidence', 'find a real billId in data/db.json', 'could not read a bill id');
  } else {
    const { status, body } = await hit(`/api/evidence/${encodeURIComponent(billId)}`);
    let parsed = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      /* parsed stays null */
    }
    record(status === 200, 'B:evidence', `real billId ${billId} → ${status}`, `expected 200, got ${status}`);
    record(
      parsed !== null && typeof parsed.chainVerified === 'boolean',
      'B:evidence',
      'evidence pack has boolean chainVerified',
      `body: ${body.slice(0, 120)}`,
    );
    record(
      parsed !== null && parsed.chainVerified === true,
      'B:evidence',
      'seeded ledger chain verifies (chainVerified === true)',
      `chainStatus=${parsed?.chainStatus}`,
    );
  }
  for (const garbage of ['totally-bogus-bill', "x'--", '%00', '../../etc/passwd']) {
    const { status } = await hit(`/api/evidence/${encodeURIComponent(garbage)}`);
    record(
      status === 404 || status === 400,
      'B:evidence',
      `garbage billId ${JSON.stringify(garbage)} → ${status}`,
      `expected 404/400, got ${status}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Group C — routes under abuse                                        */
/* ------------------------------------------------------------------ */

async function groupRoutes() {
  const checks = [
    { path: '/', expect: [200] },
    { path: '/sites/sunrise-heights', expect: [200] },
    { path: '/sites/garbage-id', expect: [404] },
    { path: '/sites/%3Cscript%3Ealert(1)%3C%2Fscript%3E', expect: [200, 404], noEcho: '<script>alert(1)</script>' },
    { path: '/reconciliation', expect: [200] },
    { path: '/reconciliation?site=nonsense', expect: [200, 404] },
    { path: '/alerts?filter=nonsense', expect: [200, 404] },
    { path: "/api/evidence/x'--", expect: [200, 404, 400] },
  ];
  for (const c of checks) {
    const { status, body } = await hit(c.path);
    record(
      c.expect.includes(status) && !is5xx(status),
      'C:routes',
      `GET ${c.path} → ${status}`,
      `expected ${c.expect.join('/')}, got ${status}`,
    );
    if (c.noEcho) {
      record(
        !body.includes(c.noEcho),
        'C:routes',
        `GET ${c.path} does not echo raw ${c.noEcho}`,
        'raw script tag found unescaped in response body',
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Group D — concurrency                                               */
/* ------------------------------------------------------------------ */

async function groupConcurrency() {
  for (const endpoint of ['counts', 'events', 'heartbeat']) {
    const url = `/api/ingest/${endpoint}`;
    const results = await Promise.all(
      Array.from({ length: 12 }, () => hit(url, postJsonInit(VALID[endpoint]))),
    );
    const bad = results.filter((r) => is5xx(r.status));
    record(
      bad.length === 0,
      'D:concurrency',
      `12 parallel POSTs to ${url} → statuses [${[...new Set(results.map((r) => r.status))].join(',')}]`,
      `${bad.length} request(s) hit 5xx/network-error`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Group E — corruption recovery                                       */
/* ------------------------------------------------------------------ */

async function groupCorruption() {
  let wrote = false;
  try {
    fs.writeFileSync(DB_FILE, '{corrupt', 'utf8');
    wrote = true;
  } catch (err) {
    record(false, 'E:corruption', 'overwrite data/db.json with garbage', String(err));
  }
  if (wrote) {
    const { status } = await hit('/');
    record(status === 200, 'E:corruption', `GET / with corrupt db.json → ${status}`, `expected 200 (store should re-seed), got ${status}`);
    const second = await hit('/sites/sunrise-heights');
    record(
      second.status === 200,
      'E:corruption',
      `GET /sites/sunrise-heights after recovery → ${second.status}`,
      `expected 200, got ${second.status}`,
    );
  }
  // Restore: delete the file so the store re-seeds deterministically next read.
  try {
    fs.rmSync(DB_FILE, { force: true });
    const { status } = await hit('/');
    record(status === 200, 'E:corruption', `GET / after db.json deleted (fresh seed) → ${status}`, `expected 200, got ${status}`);
  } catch (err) {
    record(false, 'E:corruption', 'delete data/db.json to restore', String(err));
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`Haazri stress harness → ${BASE_URL}`);

  // Readiness probe (tolerate a server still warming up).
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const { status } = await hit('/');
    if (status > 0) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!ready) {
    console.log(`FAIL [readiness] server never responded at ${BASE_URL}`);
    console.log('STRESS: 0/1 passed');
    process.exit(1);
  }

  await groupIngestFuzz();
  await groupEvidence();
  await groupRoutes();
  await groupConcurrency();
  await groupCorruption();

  const total = pass + fail;
  console.log(`STRESS: ${pass}/${total} passed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
