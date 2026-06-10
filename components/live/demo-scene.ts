import type { CameraKind } from '@/lib/types';

/** Internal render resolution of the demo feed (16:9, CCTV-ish). */
export const DEMO_WIDTH = 640;
export const DEMO_HEIGHT = 360;

const W = DEMO_WIDTH;
const H = DEMO_HEIGHT;

/** FNV-1a — stable numeric hash so each camera id gets its own scene. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 — tiny seeded PRNG; deterministic per camera id. */
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

/**
 * A worker silhouette. Position is a pure function of time — two stacked
 * sinusoids per axis give a smooth, organic wander with zero per-frame state,
 * so pausing/resuming the loop (tab hidden) can never cause a jump or jitter.
 */
interface WalkerSprite {
  cx: number;
  cy: number;
  ax1: number;
  ax2: number;
  wx1: number;
  wx2: number;
  px1: number;
  px2: number;
  ay1: number;
  ay2: number;
  wy1: number;
  wy2: number;
  py1: number;
  py2: number;
  bobFreq: number;
  bobPhase: number;
}

interface DustMote {
  x0: number;
  y0: number;
  period: number;
  phase: number;
  driftX: number;
  rise: number;
  size: number;
  maxAlpha: number;
}

interface SkylineBlock {
  x: number;
  w: number;
  h: number;
}

function walkerPos(
  s: WalkerSprite,
  t: number,
  horizon: number,
): { x: number; y: number; scale: number; bob: number } {
  let x =
    s.cx + s.ax1 * Math.sin(s.wx1 * t + s.px1) + s.ax2 * Math.sin(s.wx2 * t + s.px2);
  let y =
    s.cy + s.ay1 * Math.sin(s.wy1 * t + s.py1) + s.ay2 * Math.sin(s.wy2 * t + s.py2);
  x = Math.min(W - 36, Math.max(36, x));
  y = Math.min(H - 16, Math.max(horizon + 26, y));
  const depth = (y - horizon) / (H - horizon);
  const scale = 0.42 + 0.78 * depth;
  const bob = Math.sin(t * s.bobFreq + s.bobPhase) * 1.4 * scale;
  return { x, y, scale, bob };
}

function drawWalker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  bob: number,
): void {
  // ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * scale, 2.4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const top = y - 44 * scale + bob;

  // body capsule
  ctx.strokeStyle = 'rgba(148, 158, 178, 0.46)';
  ctx.lineWidth = 8.5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, top + 13 * scale);
  ctx.lineTo(x, y - 7 * scale + bob);
  ctx.stroke();

  // head
  ctx.fillStyle = 'rgba(170, 180, 198, 0.55)';
  ctx.beginPath();
  ctx.arc(x, top + 4.4 * scale, 4.2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawGate(ctx: CanvasRenderingContext2D, t: number): void {
  const x1 = W * 0.345;
  const x2 = W * 0.655;
  const top = H * 0.205;
  const base = H * 0.795;
  const postW = 9;

  ctx.fillStyle = '#14161b';
  ctx.strokeStyle = 'rgba(158, 168, 190, 0.20)';
  ctx.lineWidth = 1;

  // posts
  for (const px of [x1, x2]) {
    ctx.beginPath();
    ctx.rect(px - postW / 2, top, postW, base - top);
    ctx.fill();
    ctx.stroke();
  }
  // lintel
  ctx.beginPath();
  ctx.rect(x1 - postW, top - 4, x2 - x1 + postW * 2, 9);
  ctx.fill();
  ctx.stroke();
  // small sign board centred on the lintel
  ctx.beginPath();
  ctx.rect(W / 2 - 26, top - 18, 52, 12);
  ctx.fill();
  ctx.stroke();

  // soft pulsing lamp on the lintel
  const pulse = 0.30 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2));
  ctx.fillStyle = `rgba(45, 177, 83, ${pulse.toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(W / 2, top - 22, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrane(ctx: CanvasRenderingContext2D, t: number, horizon: number): void {
  const baseX = W * 0.205;
  const baseY = horizon + 10;
  const mastTop = H * 0.095;
  const sway = 6 * Math.sin(t * 0.13);

  ctx.strokeStyle = 'rgba(150, 162, 184, 0.30)';
  ctx.lineCap = 'butt';

  // mast
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(baseX, mastTop);
  ctx.stroke();
  // mast lattice
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150, 162, 184, 0.14)';
  for (let y = mastTop + 10; y < baseY - 6; y += 14) {
    ctx.beginPath();
    ctx.moveTo(baseX - 4, y);
    ctx.lineTo(baseX + 4, y + 9);
    ctx.stroke();
  }

  const jibX = baseX + 150 + sway;
  const jibY = mastTop + 6;
  ctx.strokeStyle = 'rgba(150, 162, 184, 0.30)';
  ctx.lineWidth = 2.5;
  // jib + counter-jib
  ctx.beginPath();
  ctx.moveTo(baseX - 54, mastTop + 4);
  ctx.lineTo(baseX, mastTop);
  ctx.lineTo(jibX, jibY);
  ctx.stroke();
  // tie lines from the apex
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(baseX, mastTop - 14);
  ctx.lineTo((baseX + jibX) / 2, jibY - 2);
  ctx.moveTo(baseX, mastTop - 14);
  ctx.lineTo(baseX - 54, mastTop + 4);
  ctx.stroke();
  // apex stub
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(baseX, mastTop);
  ctx.lineTo(baseX, mastTop - 14);
  ctx.stroke();

  // hook cable with a slow breathe
  const cable = 42 + 6 * Math.sin(t * 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(jibX - 14, jibY);
  ctx.lineTo(jibX - 14, jibY + cable);
  ctx.stroke();
  ctx.fillStyle = 'rgba(150, 162, 184, 0.34)';
  ctx.fillRect(jibX - 17, jibY + cable, 6, 5);
}

function drawSolar(ctx: CanvasRenderingContext2D, t: number): void {
  const poleX = W * 0.835;
  const baseY = H * 0.74;
  const poleTop = H * 0.305;

  ctx.strokeStyle = 'rgba(150, 168, 196, 0.28)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(poleX, baseY);
  ctx.lineTo(poleX, poleTop);
  ctx.stroke();

  // tilted panel
  ctx.fillStyle = '#10141c';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(poleX - 34, poleTop - 4);
  ctx.lineTo(poleX + 30, poleTop - 22);
  ctx.lineTo(poleX + 38, poleTop - 6);
  ctx.lineTo(poleX - 26, poleTop + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // panel cell lines
  ctx.strokeStyle = 'rgba(150, 168, 196, 0.14)';
  for (let i = 1; i < 4; i++) {
    const f = i / 4;
    ctx.beginPath();
    ctx.moveTo(poleX - 34 + 64 * f, poleTop - 4 - 18 * f);
    ctx.lineTo(poleX - 26 + 64 * f, poleTop + 12 - 18 * f);
    ctx.stroke();
  }

  // battery box + slow status LED
  ctx.fillStyle = '#13161d';
  ctx.strokeStyle = 'rgba(150, 168, 196, 0.24)';
  ctx.beginPath();
  ctx.rect(poleX - 8, H * 0.52, 16, 24);
  ctx.fill();
  ctx.stroke();
  const led = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.6));
  ctx.fillStyle = `rgba(45, 177, 83, ${led.toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(poleX, H * 0.545, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Builds a deterministic night-site renderer for one camera. Returns a
 * `draw(tSeconds)` that repaints the whole frame — every element is a pure
 * function of `t`, so the caller can pause and resume freely.
 */
export function createDemoRenderer(
  ctx: CanvasRenderingContext2D,
  cameraId: string,
  kind: CameraKind,
): (t: number) => void {
  const rand = mulberry32(hashString(cameraId));

  const horizon = H * (0.40 + rand() * 0.06);
  const vpX = W * (0.38 + rand() * 0.24);

  // distant skyline blocks along the horizon
  const skyline: SkylineBlock[] = [];
  let sx = rand() * 40;
  while (sx < W) {
    const bw = 36 + rand() * 80;
    skyline.push({ x: sx, w: bw, h: 8 + rand() * 22 });
    sx += bw + 8 + rand() * 36;
  }

  // 2–4 wandering workers
  const walkerCount = 2 + Math.floor(rand() * 3);
  const walkers: WalkerSprite[] = [];
  for (let i = 0; i < walkerCount; i++) {
    walkers.push({
      cx: W * (0.22 + rand() * 0.56),
      cy: horizon + 30 + rand() * (H - horizon - 56),
      ax1: 55 + rand() * 60,
      ax2: 18 + rand() * 22,
      wx1: 0.05 + rand() * 0.10,
      wx2: 0.14 + rand() * 0.10,
      px1: rand() * Math.PI * 2,
      px2: rand() * Math.PI * 2,
      ay1: 14 + rand() * 16,
      ay2: 6 + rand() * 8,
      wy1: 0.04 + rand() * 0.07,
      wy2: 0.11 + rand() * 0.08,
      py1: rand() * Math.PI * 2,
      py2: rand() * Math.PI * 2,
      bobFreq: 1.6 + rand() * 0.7,
      bobPhase: rand() * Math.PI * 2,
    });
  }

  // drifting dust motes
  const motes: DustMote[] = [];
  for (let i = 0; i < 16; i++) {
    motes.push({
      x0: rand() * W,
      y0: horizon + 16 + rand() * (H - horizon - 16),
      period: 5 + rand() * 7,
      phase: rand() * 12,
      driftX: -18 + rand() * 36,
      rise: 20 + rand() * 32,
      size: 0.8 + rand() * 1.2,
      maxAlpha: 0.05 + rand() * 0.09,
    });
  }

  // static gradients, built once
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#08090c');
  sky.addColorStop(1, '#0b0d11');
  const ground = ctx.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#0e1014');
  ground.addColorStop(1, '#15171c');
  const pool = ctx.createRadialGradient(vpX, H * 0.74, 10, vpX, H * 0.74, W * 0.42);
  pool.addColorStop(0, 'rgba(120, 142, 182, 0.055)');
  pool.addColorStop(1, 'rgba(120, 142, 182, 0)');
  const vignette = ctx.createRadialGradient(
    W / 2, H * 0.52, H * 0.34,
    W / 2, H * 0.52, W * 0.72,
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.52)');

  return function draw(t: number): void {
    // sky + skyline
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#0d0f13';
    for (const b of skyline) {
      ctx.fillRect(b.x, horizon - b.h, b.w, b.h);
    }

    // ground + light pool
    ctx.fillStyle = ground;
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = pool;
    ctx.fillRect(0, horizon, W, H - horizon);

    // perspective grid — radial lines to the vanishing point
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(124, 144, 176, 0.07)';
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(vpX, horizon);
      ctx.lineTo(vpX + i * (W / 7), H);
      ctx.stroke();
    }
    // horizontal grid lines, bunched toward the horizon
    for (let k = 1; k <= 7; k++) {
      const f = Math.pow(k / 7, 1.8);
      const y = horizon + (H - horizon) * f;
      ctx.strokeStyle = `rgba(124, 144, 176, ${(0.035 + 0.05 * f).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // static structure for this camera kind
    if (kind === 'gate') drawGate(ctx, t);
    else if (kind === 'zone') drawCrane(ctx, t, horizon);
    else drawSolar(ctx, t);

    // workers, far → near so nearer silhouettes overlap correctly
    const placed = walkers
      .map((s) => walkerPos(s, t, horizon))
      .sort((a, b) => a.y - b.y);
    for (const p of placed) {
      drawWalker(ctx, p.x, p.y, p.scale, p.bob);
    }

    // dust motes
    for (const m of motes) {
      const cyc = ((t + m.phase) % m.period) / m.period;
      const alpha = m.maxAlpha * Math.sin(Math.PI * cyc);
      if (alpha <= 0.004) continue;
      ctx.fillStyle = `rgba(200, 210, 228, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(m.x0 + m.driftX * cyc, m.y0 - m.rise * cyc, m.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // vignette
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  };
}
