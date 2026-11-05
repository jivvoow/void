/**
 * Geometry for "찢어서 홀씨": split polygons of paper along the path the finger actually drew.
 * Pure functions, no React — the pieces are plain polygons whose torn edges are flagged so they
 * can be drawn fluffy.
 */
export interface Pt {
  x: number;
  y: number;
}

/** Closed polygon; `torn[i]` says whether the edge pts[i] → pts[i+1] is a torn edge. */
export interface Poly {
  pts: Pt[];
  torn: boolean[];
}

/** Scraps smaller than this (px²) are not cut off — no slivers. */
const MIN_AREA = 900;
const EPS = 1e-6;

export function rectPoly(W: number, H: number): Poly {
  return {
    pts: [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ],
    torn: [false, false, false, false],
  };
}

export function polyArea(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function centroid(pts: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < EPS) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function bounds(pts: Pt[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

export function pointInPoly(pt: Pt, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** a + t(b-a) = c + u(d-c) with t,u ∈ [0,1]. */
function intersect(a: Pt, b: Pt, c: Pt, d: Pt) {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < EPS) return null;
  const qp = { x: c.x - a.x, y: c.y - a.y };
  const t = (qp.x * s.y - qp.y * s.x) / den;
  const u = (qp.x * r.y - qp.y * r.x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, p: { x: a.x + r.x * t, y: a.y + r.y * t } };
}

interface Hit {
  s: number; // position along the path (segment index + t)
  li: number;
  pi: number; // polygon edge index
  u: number;
  p: Pt;
}

/** Boundary of `poly` walking forward from hit `a` to hit `b` (both on edges). */
function walk(poly: Poly, a: Hit, b: Hit) {
  const n = poly.pts.length;
  const pts: Pt[] = [a.p];
  const torn: boolean[] = [poly.torn[a.pi]];
  const sameEdgeForward = a.pi === b.pi && a.u < b.u;
  if (!sameEdgeForward) {
    let k = (a.pi + 1) % n;
    for (let guard = 0; guard <= n; guard++) {
      pts.push(poly.pts[k]);
      torn.push(poly.torn[k]);
      if (k === b.pi) break;
      k = (k + 1) % n;
    }
  }
  return { pts, torn };
}

/**
 * Split `poly` along `path` (a polyline). Every stretch of the path that runs through the polygon
 * from one edge to another cuts it; returns the resulting pieces (or `[poly]` if nothing cut).
 */
export function splitByPath(poly: Poly, path: Pt[], depth = 0): Poly[] {
  if (path.length < 2 || depth > 12) return [poly];
  const n = poly.pts.length;
  const hits: Hit[] = [];
  for (let li = 0; li < path.length - 1; li++) {
    for (let pi = 0; pi < n; pi++) {
      const r = intersect(path[li], path[li + 1], poly.pts[pi], poly.pts[(pi + 1) % n]);
      if (r && li + r.t > 1e-4) hits.push({ s: li + r.t, li, pi, u: r.u, p: r.p });
    }
  }
  if (hits.length < 2) return [poly];
  hits.sort((h1, h2) => h1.s - h2.s);
  const A = hits[0];
  const B = hits[1];
  const rest = [B.p, ...path.slice(B.li + 1)];

  // The stretch A→B of the path, and whether it runs inside the polygon (not around it).
  const chord = [A.p, ...path.slice(A.li + 1, B.li + 1), B.p];
  const probe =
    chord.length > 2 ? chord[Math.floor(chord.length / 2)] : { x: (A.p.x + B.p.x) / 2, y: (A.p.y + B.p.y) / 2 };
  if (!pointInPoly(probe, poly.pts) || B.s - A.s < 1e-4) return splitByPath(poly, rest, depth + 1);

  const inner = chord.slice(1, -1);
  const w1 = walk(poly, A, B); // A … B along the boundary
  const w2 = walk(poly, B, A); // B … A
  const p1: Poly = {
    pts: [...w1.pts, B.p, ...[...inner].reverse()],
    torn: [...w1.torn, ...inner.map(() => true), true],
  };
  const p2: Poly = {
    pts: [...w2.pts, A.p, ...inner],
    torn: [...w2.torn, ...inner.map(() => true), true],
  };
  if (polyArea(p1.pts) < MIN_AREA || polyArea(p2.pts) < MIN_AREA) return splitByPath(poly, rest, depth + 1);
  return [...splitByPath(p1, rest, depth + 1), ...splitByPath(p2, rest, depth + 1)];
}

/** Resample a finger path evenly (drops jitter and duplicate points). */
export function resample(path: Pt[], step: number): Pt[] {
  if (path.length < 2) return path.slice();
  const out: Pt[] = [path[0]];
  let carry = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = step - carry;
    while (d <= len) {
      out.push({ x: a.x + ((b.x - a.x) * d) / len, y: a.y + ((b.y - a.y) * d) / len });
      d += step;
    }
    carry = len - (d - step);
  }
  const last = path[path.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.3) out.push(last);
  return out;
}

/** A tear that stops inside the sheet keeps going in the same direction until it leaves it. */
export function extendThrough(path: Pt[], W: number, H: number): Pt[] {
  if (path.length < 2) return path;
  const reach = W + H;
  const dirAt = (from: Pt, to: Pt) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
  };
  const k = Math.min(3, path.length - 1);
  const d0 = dirAt(path[k], path[0]);
  const d1 = dirAt(path[path.length - 1 - k], path[path.length - 1]);
  const inside = (p: Pt) => p.x > 0 && p.x < W && p.y > 0 && p.y < H;
  const head = inside(path[0]) ? [{ x: path[0].x + d0.x * reach, y: path[0].y + d0.y * reach }] : [];
  const lastP = path[path.length - 1];
  const tail = inside(lastP) ? [{ x: lastP.x + d1.x * reach, y: lastP.y + d1.y * reach }] : [];
  return [...head, ...path, ...tail];
}

/** Paper never tears in a clean line: jitter the path sideways (deterministically). */
export function roughen(path: Pt[], seed: number, step = 6, amp = 2.6): Pt[] {
  const pts = resample(path, step);
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const a = pts[i - 1];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const j = (v - Math.floor(v) - 0.5) * 2 * amp;
    return { x: p.x + nx * j, y: p.y + ny * j };
  });
}

/** SVG path of a polygon, and of its torn edges only. */
export function polyPaths(poly: Poly) {
  const f = (p: Pt) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  const fill = poly.pts.map((p, i) => `${i ? 'L' : 'M'}${f(p)}`).join(' ') + ' Z';
  let torn = '';
  const n = poly.pts.length;
  for (let i = 0; i < n; i++) {
    if (!poly.torn[i]) continue;
    const a = poly.pts[i];
    const b = poly.pts[(i + 1) % n];
    torn += `M${f(a)} L${f(b)} `;
  }
  return { fill, torn };
}
