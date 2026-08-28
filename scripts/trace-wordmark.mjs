/**
 * Traces the high-resolution wordmark into an SVG.
 *
 *   npm run build:wordmark
 *
 * Why this exists: the hero leads with the wordmark at a size no raster in this
 * project can carry. The print logo is 392px wide; the higher-resolution
 * redraw is 991px. A hero wordmark at ~800 CSS px on a 3x phone needs ~2400px,
 * so even the redraw is short. Vector removes the ceiling entirely.
 *
 * An earlier attempt to trace the PRINT file failed and was thrown away: it is
 * a JPEG, so its high-contrast edges carry compression ringing, and
 * thresholding that produces a contour that genuinely wobbles — the traced
 * curves came out wavier than the raster was soft. This source is different in
 * the two ways that matter: it is a PNG with a clean alpha channel (no ringing
 * to chase) and it is 2.5x the resolution (so the marching-squares staircase is
 * much finer relative to the letterforms).
 *
 * Pipeline: supersample -> marching squares -> Chaikin -> Douglas-Peucker ->
 * corner-preserving Bezier fit.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'src/assets/source/noorture-wordmark-hires.png');
const OUT = resolve(root, 'src/assets/noorture-wordmark.svg');

/** Supersample factor for the contour grid. */
const SCALE = 3;
/** Small blur to even out the alpha edge before thresholding. */
const PRE_BLUR = 1.6;
/** Chaikin corner-cutting passes. */
const SMOOTH_PASSES = 2;
/** Douglas-Peucker tolerance, in supersampled pixels. */
const TOLERANCE = 1.1;
/**
 * Turn angle, in degrees, above which a vertex is treated as a corner and the
 * curve is broken. Serif terminals and the flat cuts of this typeface are real
 * corners; rounding them is what makes a traced serif look melted.
 */
const CORNER_DEGREES = 42;

/* ------------------------------------------------------------------ */

const meta = await sharp(SRC).metadata();
const W = meta.width * SCALE;
const H = meta.height * SCALE;

const { data } = await sharp(SRC)
  .ensureAlpha()
  .resize(W, H, { kernel: 'lanczos3' })
  .blur(PRE_BLUR)
  .raw()
  .toBuffer({ resolveWithObject: true });

// Colour is read from the unblurred pixels: blurring bleeds rose into aqua
// across the letter gaps and would corrupt the O's classification.
const crisp = await sharp(SRC)
  .ensureAlpha()
  .resize(W, H, { kernel: 'lanczos3' })
  .raw()
  .toBuffer();

const alphaAt = (x, y) =>
  x < 0 || y < 0 || x >= W || y >= H ? 0 : data[(y * W + x) * 4 + 3];
const solid = (x, y) => alphaAt(x, y) >= 128;

/* ---------------- marching squares ---------------- */

const segments = [];
for (let y = -1; y < H; y++) {
  for (let x = -1; x < W; x++) {
    const c =
      (solid(x, y) ? 8 : 0) |
      (solid(x + 1, y) ? 4 : 0) |
      (solid(x + 1, y + 1) ? 2 : 0) |
      (solid(x, y + 1) ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = [x + 0.5, y];
    const R = [x + 1, y + 0.5];
    const B = [x + 0.5, y + 1];
    const L = [x, y + 0.5];
    const push = (a, b) => segments.push([a, b]);
    switch (c) {
      case 1: push(L, B); break;
      case 2: push(B, R); break;
      case 3: push(L, R); break;
      case 4: push(R, T); break;
      case 5: push(L, T); push(B, R); break;
      case 6: push(B, T); break;
      case 7: push(L, T); break;
      case 8: push(T, L); break;
      case 9: push(T, B); break;
      case 10: push(T, R); push(B, L); break;
      case 11: push(T, R); break;
      case 12: push(R, L); break;
      case 13: push(R, B); break;
      case 14: push(B, L); break;
    }
  }
}

/* ---------------- link into closed loops ---------------- */

const key = (p) => `${p[0]}:${p[1]}`;
const outgoing = new Map();
for (const [a, b] of segments) {
  const k = key(a);
  if (!outgoing.has(k)) outgoing.set(k, []);
  outgoing.get(k).push(b);
}

const used = new Set();
const loops = [];
for (const [a, b] of segments) {
  const first = `${key(a)}->${key(b)}`;
  if (used.has(first)) continue;
  used.add(first);
  const loop = [a];
  let current = b;
  for (let guard = 0; guard < 8_000_000; guard++) {
    loop.push(current);
    const outs = outgoing.get(key(current));
    if (!outs) break;
    let next = null;
    for (const cand of outs) {
      const k = `${key(current)}->${key(cand)}`;
      if (used.has(k)) continue;
      used.add(k);
      next = cand;
      break;
    }
    if (!next) break;
    current = next;
    if (key(current) === key(loop[0])) break;
  }
  if (loop.length > 12) loops.push(loop);
}

/* ---------------- smoothing and simplification ---------------- */

function chaikin(loop) {
  const out = [];
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i];
    const [x2, y2] = loop[(i + 1) % loop.length];
    out.push([x1 * 0.75 + x2 * 0.25, y1 * 0.75 + y2 * 0.25]);
    out.push([x1 * 0.25 + x2 * 0.75, y1 * 0.25 + y2 * 0.75]);
  }
  return out;
}

function rdp(points, tol) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  let maxDist = -1;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const dist = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist <= tol) return [points[0], points[points.length - 1]];
  return [
    ...rdp(points.slice(0, index + 1), tol).slice(0, -1),
    ...rdp(points.slice(index), tol),
  ];
}

/**
 * RDP on a closed loop. Feeding one straight to the open-polyline version
 * collapses it to two points: the first and last vertex coincide, so the
 * reference line is degenerate and every distance computes as zero.
 */
function rdpClosed(loop, tol) {
  if (loop.length < 4) return loop;
  const [x0, y0] = loop[0];
  let far = 0;
  let farDist = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = (loop[i][0] - x0) ** 2 + (loop[i][1] - y0) ** 2;
    if (d > farDist) {
      farDist = d;
      far = i;
    }
  }
  const a = rdp(loop.slice(0, far + 1), tol);
  const b = rdp([...loop.slice(far), loop[0]], tol);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

const area = (loop) => {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i];
    const [x2, y2] = loop[(i + 1) % loop.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/* ---------------- corner-preserving Bezier fit ---------------- */

/** Interior turn angle at vertex i, in degrees. 180 is straight. */
function turnAt(loop, i) {
  const n = loop.length;
  const [px, py] = loop[(i - 1 + n) % n];
  const [cx, cy] = loop[i];
  const [nx, ny] = loop[(i + 1) % n];
  const a1 = Math.atan2(cy - py, cx - px);
  const a2 = Math.atan2(ny - cy, nx - cx);
  let d = Math.abs(a2 - a1) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
}

/**
 * Emit a closed path, drawing smooth cubics through the points and dropping to
 * straight lines across corners. Control points come from a Catmull-Rom
 * tangent, scaled to a sixth of the neighbouring span, which is the standard
 * conversion and keeps the curve tight to its points.
 */
function toPath(loop) {
  const n = loop.length;
  if (n < 3) return '';
  const corner = loop.map((_, i) => turnAt(loop, i) > CORNER_DEGREES);
  const f = (v) => (Math.round(v * 100) / 100).toString();
  let d = `M${f(loop[0][0])},${f(loop[0][1])}`;

  for (let i = 0; i < n; i++) {
    const p0 = loop[(i - 1 + n) % n];
    const p1 = loop[i];
    const p2 = loop[(i + 1) % n];
    const p3 = loop[(i + 2) % n];

    if (corner[i] && corner[(i + 1) % n]) {
      d += `L${f(p2[0])},${f(p2[1])}`;
      continue;
    }
    // A corner kills the tangent on its own side only, so the segment leaving
    // a serif tip stays straight where it should and curves where it should.
    const t1 = corner[i] ? [0, 0] : [(p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6];
    const t2 = corner[(i + 1) % n]
      ? [0, 0]
      : [(p3[0] - p1[0]) / 6, (p3[1] - p1[1]) / 6];
    const c1 = [p1[0] + t1[0], p1[1] + t1[1]];
    const c2 = [p2[0] - t2[0], p2[1] - t2[1]];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Colour family, sampled next to the contour's own vertices. */
function familyOf(loop) {
  let rose = 0;
  let aqua = 0;
  const step = Math.max(1, Math.floor(loop.length / 80));
  for (let i = 0; i < loop.length; i += step) {
    const fx = Math.round(loop[i][0]);
    const fy = Math.round(loop[i][1]);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = fx + dx;
        const y = fy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i4 = (y * W + x) * 4;
        if (crisp[i4 + 3] < 220) continue;
        if (crisp[i4] - crisp[i4 + 1] > 20) rose++;
        else aqua++;
      }
    }
  }
  return rose > aqua ? 'rose' : 'aqua';
}

/* ---------------- assemble ---------------- */

const kept = loops
  .filter((loop) => Math.abs(area(loop)) > 8 * SCALE * SCALE)
  .map((raw) => {
    let smooth = raw;
    for (let i = 0; i < SMOOTH_PASSES; i++) smooth = chaikin(smooth);
    return { points: rdpClosed(smooth, TOLERANCE), raw };
  })
  .filter(({ points }) => points.length >= 3);

// Trim to the ink, so the SVG has no dead margin to lay out around.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const { points } of kept) {
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
}

const groups = { aqua: [], rose: [] };
for (const { points, raw } of kept) {
  const shifted = points.map(([x, y]) => [(x - minX) / SCALE, (y - minY) / SCALE]);
  groups[familyOf(raw)].push(toPath(shifted));
}

const vbW = ((maxX - minX) / SCALE).toFixed(2);
const vbH = ((maxY - minY) / SCALE).toFixed(2);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" role="img" aria-label="Noorture">
<title>Noorture</title>
<g fill-rule="evenodd">
<path fill="var(--noor-wordmark-aqua, #7FD2D4)" d="${groups.aqua.join('')}"/>
<path fill="var(--noor-wordmark-rose, #E9A3C4)" d="${groups.rose.join('')}"/>
</g>
</svg>
`;

writeFileSync(OUT, svg);
console.log(`loops: ${kept.length} (aqua ${groups.aqua.length}, rose ${groups.rose.length})`);
console.log(`viewBox ${vbW} x ${vbH}`);
console.log(`${OUT} — ${(svg.length / 1024).toFixed(1)} KB`);
