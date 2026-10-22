#!/usr/bin/env node
/**
 * Raw circuit data (fetched by fetch.sh) → the centreline modules under src/sim/track/data.
 *
 *   node scripts/tracks/convert.mjs <raw dir> <out dir> [--report]
 *   e.g. node scripts/tracks/convert.mjs .tools/tmp/trackdata/raw src/sim/track/data
 *
 * Reads CSV and JSON only; runs nothing from the downloads. For each circuit: the loop in
 * driving order in metres (OSM: WGS84 onto the tangent plane at the circuit), densified,
 * lightly smoothed along the lap (Gaussian), started at the start/finish line, turned so the
 * start straight points along +x, resampled at an even spacing of about 5 m, and written
 * compactly: centimetres, each point as the step from the one before. --report also prints
 * the curvature peaks (for placing the named corners) and the lengths.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [raw, out, flag] = process.argv.slice(2);
if (!raw || !out) {
  console.error('usage: node scripts/tracks/convert.mjs <raw dir> <out dir> [--report]');
  process.exit(1);
}
const REPORT = flag === '--report';

/** spacing of the stored points (m) */
const SPACING = 5;
/** densified step before smoothing (m) */
const DENSE = 0.5;

const TUM = 'TUMFTM racetrack-database (github.com/TUMFTM/racetrack-database, LGPL-3.0)';
const OSM = 'OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0) via the Overpass API';

/**
 * The circuits. TUMFTM's loops start at the start/finish line and come smoothed already; OSM's
 * are chains of ways (polylines with corners at their nodes), smoothed a little more. OSM has no
 * width for these: a stated typical width (~) is used, with its source note in the track spec.
 */
const TRACKS = [
  { id: 'monza', kind: 'tumftm', file: 'Monza.csv', smooth: 1, smoothW: 10, official: 5793 },
  {
    id: 'silverstone',
    kind: 'tumftm',
    file: 'Silverstone.csv',
    smooth: 1,
    smoothW: 10,
    official: 5891,
  },
  { id: 'spa', kind: 'tumftm', file: 'Spa.csv', smooth: 1, smoothW: 10, official: 7004 },
  {
    id: 'monaco',
    kind: 'osm',
    file: 'monaco.json',
    // the circuit relation and its start-finish node; its pit lane (role pit_lane) and pit exit
    // (no role) are left out, and two 2-node scraps of the carriageway at Massenet that zigzag
    // across the road (the chain bridges the 38 m straight)
    relation: 148194,
    skip: [1388331347, 1551240830, 1551240829],
    tol: 45,
    clockwise: true,
    width: 9,
    smooth: 2,
    official: 3337,
  },
  {
    id: 'laguna-seca',
    kind: 'osm',
    file: 'laguna-seca.json',
    relation: 21195763,
    // ~ no start/finish node mapped: the line where the old map-measured layout had it, 323 m
    // after T11 and 216 m before T1 (as shares of the straight between them in this data)
    start: { lat: 36.5862282, lon: -121.7565173 },
    clockwise: false,
    width: 12,
    smooth: 2,
    official: 3602,
  },
  {
    id: 'top-gear',
    kind: 'osm',
    file: 'dunsfold.json',
    // every raceway way on the aerodrome, chained from Crooner Curves in its drawn direction
    first: 68045749,
    // ~ no start/finish node mapped: the line where the old layout had it, 60 m after Gambon
    // and 220 m before Crooner Curves (as shares of the straight between them in this data)
    start: { lat: 51.1185913, lon: -0.5372427 },
    width: 14,
    smooth: 2,
    official: 2820,
  },
];

// ── geometry helpers ─────────────────────────────────────────────────────────────────────

/** WGS84 → metres east/north of (lat0, lon0) on the local tangent plane. */
function projector(lat0, lon0) {
  const a = 6378137;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const p = (lat0 * Math.PI) / 180;
  const w = 1 - e2 * Math.sin(p) ** 2;
  const N = a / Math.sqrt(w);
  const M = (a * (1 - e2)) / w ** 1.5;
  const to = ([lat, lon]) => [
    N * Math.cos(p) * (((lon - lon0) * Math.PI) / 180),
    M * (((lat - lat0) * Math.PI) / 180),
  ];
  to.back = ([x, y]) => [
    lat0 + (y / M) * (180 / Math.PI),
    lon0 + (x / (N * Math.cos(p))) * (180 / Math.PI),
  ];
  return to;
}

/** A closed polyline densified to about `h` m; extra per-point values follow linearly. */
function densify(pts, h) {
  const res = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(len / h));
    for (let j = 0; j < k; j++) res.push(a.map((v, c) => v + ((b[c] - v) * j) / k));
  }
  return res;
}

/** Gaussian smoothing of column c of a closed sequence spaced `h` m apart, sigma in metres. */
function smooth(pts, c, sigma, h) {
  if (sigma <= 0) return pts.map((p) => p[c]);
  const s = sigma / h;
  const r = Math.ceil(3 * s);
  const w = [];
  let sum = 0;
  for (let k = -r; k <= r; k++) {
    w.push(Math.exp(-(k * k) / (2 * s * s)));
    sum += w.at(-1);
  }
  const n = pts.length;
  return pts.map((_, i) => {
    let v = 0;
    for (let k = -r; k <= r; k++) v += w[k + r] * pts[(((i + k) % n) + n) % n][c];
    return v / sum;
  });
}

const lengthOf = (pts) => {
  let L = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
};

const signedArea = (pts) => {
  let A = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    A += a[0] * b[1] - b[0] * a[1];
  }
  return A / 2;
};

/** Points at even arc length `ds` from s0 round a closed dense polyline (linear between). */
function resample(pts, n, s0) {
  const cum = [0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const L = cum.at(-1);
  const ds = L / n;
  const res = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = (s0 + i * ds) % L;
    if (cum[j] > s) j = 0;
    while (cum[j + 1] < s) j++;
    const a = pts[j];
    const b = pts[(j + 1) % pts.length];
    const t = (s - cum[j]) / Math.max(1e-12, cum[j + 1] - cum[j]);
    res.push(a.map((v, c) => v + (b[c] - v) * t));
  }
  return { res, ds, L };
}

/** Curvature at each point of an evenly spaced closed loop, over ±`span` points (Menger). */
function curvature(pts, span = 2) {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[(i - span + n) % n];
    const p = pts[i];
    const b = pts[(i + span) % n];
    const ux = p[0] - a[0];
    const uy = p[1] - a[1];
    const vx = b[0] - p[0];
    const vy = b[1] - p[1];
    const la = Math.hypot(ux, uy);
    const lb = Math.hypot(vx, vy);
    const lc = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return la * lb * lc > 0 ? (2 * (ux * vy - uy * vx)) / (la * lb * lc) : 0;
  });
}

/** Stretches tighter than 300 m radius: start, apex, end (m), tightest radius, angle (deg). */
function peaks(k, ds) {
  const n = k.length;
  const LIM = 1 / 300;
  const out = [];
  let i0 = k.findIndex((v) => Math.abs(v) < LIM);
  if (i0 < 0) i0 = 0;
  let cur = null;
  for (let j = 1; j <= n; j++) {
    const i = (i0 + j) % n;
    const on = Math.abs(k[i]) >= LIM;
    const sign = Math.sign(k[i]);
    if (on && cur && cur.sign === sign) {
      cur.end = i;
      cur.angle += k[i] * ds;
      if (Math.abs(k[i]) > Math.abs(k[cur.apex])) cur.apex = i;
    } else {
      if (cur) out.push(cur);
      cur = on ? { start: i, end: i, apex: i, sign, angle: k[i] * ds } : null;
    }
  }
  if (cur) out.push(cur);
  return out
    .filter((p) => Math.abs(p.angle) > (8 * Math.PI) / 180)
    .map((p) => ({
      s0: Math.round(p.start * ds),
      apex: Math.round(p.apex * ds),
      s1: Math.round(p.end * ds),
      r: Math.round(1 / Math.abs(k[p.apex])),
      deg: Math.round((p.angle * 180) / Math.PI),
    }))
    .sort((a, b) => a.apex - b.apex);
}

// ── sources ──────────────────────────────────────────────────────────────────────────────

function tumftm(cfg) {
  const text = readFileSync(join(raw, 'tumftm', cfg.file), 'utf8');
  // x_m, y_m, w_tr_right_m, w_tr_left_m → x, y, left, right
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split(',').map(Number))
    .map(([x, y, wr, wl]) => [x, y, wl, wr]);
  if (rows.some((r) => r.length !== 4 || r.some((v) => !Number.isFinite(v))))
    throw new Error(`${cfg.file}: unexpected row`);
  const last = rows.at(-1);
  const gap = Math.hypot(last[0] - rows[0][0], last[1] - rows[0][1]);
  return {
    pts: rows,
    rawLength: lengthOf(rows),
    gap,
    startAt: [rows[0][0], rows[0][1]],
    source: `${TUM}, tracks/${cfg.file}`,
  };
}

function osm(cfg) {
  const json = JSON.parse(readFileSync(join(raw, 'osm', cfg.file), 'utf8'));
  const geo = [];
  let startNode = null;
  if (cfg.relation) {
    const rel = json.elements.find((e) => e.type === 'relation' && e.id === cfg.relation);
    if (!rel) throw new Error(`${cfg.file}: no relation ${cfg.relation}`);
    for (const m of rel.members) {
      if (m.type === 'node' && m.role === 'start-finish') startNode = [m.lat, m.lon];
      if (m.type !== 'way' || /pit/.test(m.role ?? '') || cfg.skip?.includes(m.ref)) continue;
      geo.push({ id: m.ref, ll: m.geometry.map((g) => [g.lat, g.lon]) });
    }
  } else {
    for (const e of json.elements)
      if (e.type === 'way' && !cfg.skip?.includes(e.id))
        geo.push({ id: e.id, ll: e.geometry.map((g) => [g.lat, g.lon]) });
  }
  const all = geo.flatMap((g) => g.ll);
  const lat0 = all.reduce((s, p) => s + p[0], 0) / all.length;
  const lon0 = all.reduce((s, p) => s + p[1], 0) / all.length;
  const proj = projector(lat0, lon0);
  const segs = geo.map((g) => ({ id: g.id, pts: g.ll.map(proj) }));

  // chain the ways end to end (nearest free end; shared nodes meet exactly)
  const TOL = cfg.tol ?? 30;
  const first = cfg.first ? segs.find((s) => s.id === cfg.first) : segs[0];
  const used = new Set([first.id]);
  const loop = [...first.pts];
  const gaps = [];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (;;) {
    const end = loop.at(-1);
    let best = null;
    for (const s of segs) {
      if (used.has(s.id)) continue;
      for (const rev of [false, true]) {
        const p = rev ? s.pts.at(-1) : s.pts[0];
        const dist = d(end, p);
        if (dist < TOL && (!best || dist < best.dist)) best = { s, rev, dist };
      }
    }
    if (!best) break;
    used.add(best.s.id);
    const pts = best.rev ? [...best.s.pts].reverse() : best.s.pts;
    if (best.dist > 0.5) gaps.push({ way: best.s.id, m: +best.dist.toFixed(1) });
    loop.push(...(best.dist < 0.01 ? pts.slice(1) : pts));
  }
  const unused = segs.filter((s) => !used.has(s.id)).map((s) => s.id);
  const gap = d(loop.at(-1), loop[0]);
  if (gap < 0.01) loop.pop();
  let pts = loop.map(([x, y]) => [x, y, cfg.width / 2, cfg.width / 2]);
  // driving direction where the ways don't say it (relations list them in any order)
  if (cfg.clockwise !== undefined && signedArea(pts) > 0 === cfg.clockwise) pts = pts.reverse();
  return {
    pts,
    rawLength: lengthOf(pts),
    gap,
    gaps,
    unused,
    startAt: cfg.start ? proj([cfg.start.lat, cfg.start.lon]) : startNode && proj(startNode),
    back: proj.back,
    source: `${OSM}, ${cfg.relation ? `relation ${cfg.relation}` : 'raceway ways at Dunsfold'}`,
  };
}

// ── encode ───────────────────────────────────────────────────────────────────────────────

/** centimetres, the first absolute and each one after as the step from the one before */
const encode = (vs) => {
  let prev = 0;
  return vs
    .map((v) => {
      const c = Math.round(v * 100);
      const s = c - prev;
      prev = c;
      return s;
    })
    .join(',');
};

const LICENCE = {
  tumftm: '// Derived from the TUMFTM racetrack-database (LGPL-3.0): see LICENSE here.',
  osm: '// Derived from OpenStreetMap data, © OpenStreetMap contributors, available under the ODbL 1.0.',
};

for (const cfg of TRACKS) {
  const src = cfg.kind === 'tumftm' ? tumftm(cfg) : osm(cfg);
  const dense = densify(src.pts, DENSE);
  const cols = [0, 1].map((c) => smooth(dense, c, cfg.smooth, DENSE));
  const wcols = [2, 3].map((c) => smooth(dense, c, cfg.smoothW ?? 0, DENSE));
  const sm = dense.map((_, i) => [cols[0][i], cols[1][i], wcols[0][i], wcols[1][i]]);
  const L = lengthOf(sm);
  const n = Math.round(L / SPACING);

  // the start: TUMFTM's first point, a mapped start-finish node, or a share of the way from the
  // end of one corner to the next (found from the curvature of a first pass)
  let s0 = 0;
  const nearest = (p) => {
    let best = 0;
    for (let i = 1; i < sm.length; i++)
      if (
        Math.hypot(sm[i][0] - p[0], sm[i][1] - p[1]) <
        Math.hypot(sm[best][0] - p[0], sm[best][1] - p[1])
      )
        best = i;
    return best * (L / sm.length);
  };
  if (src.startAt) s0 = nearest(src.startAt);
  const { res, ds } = resample(sm, n, s0);
  const pk = peaks(curvature(res), ds);

  // turn so the start straight points along +x (the sim's frame), the line at the origin
  const a = res[n - 2];
  const b = res[2];
  const theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const [ox, oy] = res[0];
  const c = Math.cos(-theta);
  const s = Math.sin(-theta);
  const xs = res.map((p) => c * (p[0] - ox) - s * (p[1] - oy));
  const ys = res.map((p) => s * (p[0] - ox) + c * (p[1] - oy));
  const wl = res.map((p) => p[2]);
  const wr = res.map((p) => p[3]);

  const constant = cfg.kind === 'osm';
  const dir = cfg.kind === 'tumftm' ? 'tumftm' : 'osm';
  mkdirSync(join(out, dir), { recursive: true });
  const file = join(out, dir, `${cfg.id}.ts`);
  const lines = [
    `// Generated by scripts/tracks/convert.mjs from ${cfg.file}; regenerate rather than edit.`,
    LICENCE[dir],
    "import type { Centreline } from '../../types';",
    '',
    'const centreline: Centreline = {',
    `  source: '${src.source}',`,
    `  n: ${n},`,
    `  ds: ${ds.toFixed(4)},`,
    `  headingDeg: ${((theta * 180) / Math.PI).toFixed(1)},`,
    `  x: '${encode(xs)}',`,
    `  y: '${encode(ys)}',`,
    constant ? `  wl: ${cfg.width / 2},` : `  wl: '${encode(wl)}',`,
    constant ? `  wr: ${cfg.width / 2},` : `  wr: '${encode(wr)}',`,
    '};',
    '',
    'export default centreline;',
    '',
  ];
  writeFileSync(file, lines.join('\n'));
  const msg = {
    id: cfg.id,
    file,
    points: n,
    ds: +ds.toFixed(3),
    rawLength: +src.rawLength.toFixed(1),
    length: +L.toFixed(1),
    official: cfg.official,
    offPct: +((100 * (L - cfg.official)) / cfg.official).toFixed(2),
    closingGapM: +src.gap.toFixed(2),
    chainGaps: src.gaps,
    unusedWays: src.unused,
    headingDeg: +((theta * 180) / Math.PI).toFixed(1),
    widthM: constant
      ? cfg.width
      : [Math.min(...wl) + Math.min(...wr), Math.max(...wl) + Math.max(...wr)].map(
          (v) => +v.toFixed(1),
        ),
  };
  console.log(JSON.stringify(msg));
  if (REPORT)
    for (const p of pk) {
      // where each stretch begins and ends on the map (OSM), for placing a start line
      const ll = (m) => {
        const q = res[Math.round(m / ds) % n];
        return src.back ? src.back(q).map((v) => +v.toFixed(7)) : null;
      };
      console.log('  ', JSON.stringify({ ...p, ll0: ll(p.s0), ll1: ll(p.s1) }));
    }
}
