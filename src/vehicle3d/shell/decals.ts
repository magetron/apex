/**
 * Decal outline helpers and the generic glass/lamp/grille set. Outlines are x-monotone in the
 * decal's (u, v) plane; see DecalView for what u and v mean in each view.
 */
import { clamp, lerp, linear, smoothstep, type Pt } from './curves';
import type { BodyShapeApi, Decal } from './types';

export type Outline = Pick<Decal, 'u0' | 'u1' | 'lo' | 'hi'>;

export const ellipse = (cu: number, cv: number, ru: number, rv: number): Outline => {
  const f = (u: number) => rv * Math.sqrt(Math.max(0, 1 - ((u - cu) / ru) ** 2));
  return { u0: cu - ru, u1: cu + ru, lo: (u) => cv - f(u), hi: (u) => cv + f(u) };
};

export const roundRect = (u0: number, u1: number, v0: number, v1: number, r = 0): Outline => {
  const rr = Math.min(r, (u1 - u0) / 2, (v1 - v0) / 2);
  const inset = (u: number) => {
    const d = Math.min(u - u0, u1 - u);
    if (d >= rr || rr <= 0) return 0;
    const t = (rr - d) / rr;
    return rr * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
  };
  return { u0, u1, lo: (u) => v0 + inset(u), hi: (u) => v1 - inset(u) };
};

/** Polygon from its upper and lower boundaries (both listed in u order, sharing the end u). */
export const poly = (upper: Pt[], lower: Pt[]): Outline => {
  const us = [...upper, ...lower].map((p) => p[0]);
  return { u0: Math.min(...us), u1: Math.max(...us), lo: linear(lower), hi: linear(upper) };
};

/** Shift/shear an outline in v by a linear function of u (slanted lamps). */
export const slant = (o: Outline, dvPerDu: number, pivotU = (o.u0 + o.u1) / 2): Outline => ({
  ...o,
  lo: (u) => o.lo(u) + (u - pivotU) * dvPerDu,
  hi: (u) => o.hi(u) + (u - pivotU) * dvPerDu,
});

export interface DloOptions {
  /** front limit (x); default just behind the A-pillar base */
  front?: number;
  /** rear-bottom corner of the glass (x) */
  rear: number;
  /** where the C-pillar line meets the roof edge (x); default rear + 120 (raked forward) */
  rearTop?: number;
  /** margins below the roof edge and above the belt (mm) */
  top?: number;
  bottom?: number;
  /** visible A-pillar width in side view (mm) */
  aPillar?: number;
  /** Hofmeister-style lift of the rear-lower corner: from x, by h mm */
  kink?: { from: number; h: number };
}

/** Side daylight opening that follows the shell's own belt and roof-edge lines. */
export function dlo(s: BodyShapeApi, o: DloOptions): Outline {
  const top = o.top ?? 28;
  const bottom = o.bottom ?? 22;
  const aP = o.aPillar ?? 75;
  const front = o.front ?? s.p.cabin[1] - 10;
  const rearTop = o.rearTop ?? o.rear + 120;
  const lo = (x: number) =>
    s.belt(x) + bottom + (o.kink ? o.kink.h * smoothstep(o.kink.from, o.rear, x) : 0);
  const yT = s.roofEdge(rearTop) - top;
  const yB = lo(o.rear);
  const cLine = (x: number) => yT + ((x - rearTop) * (yT - yB)) / Math.max(1, rearTop - o.rear);
  const hi = (x: number) => Math.min(s.roofEdge(x) - top, s.roofEdge(x + aP) - top, cLine(x));
  return { u0: o.rear, u1: front, lo, hi };
}

/** Band between two x positions over the greenhouse side (B-pillar, divider). */
export const pillar = (s: BodyShapeApi, x: number, w: number): Outline => ({
  u0: x - w / 2,
  u1: x + w / 2,
  lo: (u) => s.belt(u) + 8,
  hi: (u) => s.roofEdge(u) - 4,
});

/** Top-view patch spanning the greenhouse top between x0 and x1, inset from its edges. */
export const roofPatch = (
  s: BodyShapeApi,
  x0: number,
  x1: number,
  inset: number,
  cap = Infinity,
): Outline => {
  const zw = (x: number) => Math.max(0, Math.min(cap, s.ghHalfW(x) - inset));
  return { u0: x0, u1: x1, lo: (x) => -zw(x), hi: (x) => zw(x) };
};

/** x where the centre-line top first reaches y going rearward from `from` (screen top etc.). */
export function findTopX(s: BodyShapeApi, y: number, from: number, to: number): number {
  const step = from > to ? -4 : 4;
  for (let x = from; step < 0 ? x > to : x < to; x += step) if (s.top(x) >= y) return x;
  return to;
}

/** x where the centre-line top falls below y going rearward from `from`. */
export function findTopDrop(s: BodyShapeApi, y: number, from: number, to: number): number {
  for (let x = from; x > to; x -= 4) if (s.top(x) <= y) return x;
  return to;
}

export function defaultDecals(s: BodyShapeApi): Decal[] {
  const { c, p } = s;
  const { v, xF, xR, W, H } = c;
  const out: Decal[] = [];
  const style = v.body.style;
  const roofLine = H - p.crown * 0.4;
  const screenTopX = findTopX(s, roofLine - 25, p.cabin[1], xR);
  const roofEndX = findTopDrop(s, roofLine - 30, screenTopX - 100, xR);

  // ── windscreen ──
  const screenRun = p.cabin[1] - screenTopX;
  const screenRise = H - s.top(p.cabin[1]);
  if (screenRun < 0.6 * screenRise) {
    // upright screen (off-roaders): project from the front
    const yb = s.top(p.cabin[1]) + 40;
    const yt = H - 70;
    const zw = Math.max(80, s.ghHalfW(screenTopX + 40) - 60);
    out.push({
      tag: 'windscreen',
      view: 'front',
      ...roundRect(-zw, zw, yb, yt, 30),
      mat: 'glass',
      offset: 4,
      depth: c.L,
    });
  } else {
    out.push({
      tag: 'windscreen',
      view: 'top',
      ...roofPatch(s, screenTopX - 30, p.cabin[1] - 15, 50),
      mat: 'glass',
      offset: 4,
      nu: 14,
      nv: 12,
    });
  }

  // ── rear glass ──
  const glassBase = p.cabin[0];
  const run = roofEndX - glassBase;
  const rise = s.top(roofEndX) - s.top(glassBase);
  if (v.body.tail === 'engine-deck') {
    // small near-vertical rear screen behind the cabin
    const x0 = roofEndX - 160;
    out.push({
      tag: 'rear-window',
      view: 'top',
      ...roofPatch(s, x0, roofEndX - 10, 80),
      mat: 'glass',
      offset: 4,
    });
  } else if (run < 0.7 * rise) {
    const yb = s.top(glassBase) + 40;
    const yt = s.top(roofEndX + 40) - 60;
    const zw = Math.max(80, s.ghHalfW(roofEndX - 30) - 80);
    out.push({
      tag: 'rear-window',
      view: 'rear',
      ...roundRect(-zw, zw, yb, Math.max(yb + 60, yt), 40),
      mat: 'glass',
      offset: 4,
      depth: c.L / 2,
    });
  } else {
    out.push({
      tag: 'rear-window',
      view: 'top',
      ...roofPatch(s, glassBase + 25, roofEndX - 15, 85),
      mat: 'glass',
      offset: 4,
      nu: 12,
      nv: 10,
    });
  }

  // ── side glass ──
  const rear = Math.max(
    glassBase + 40,
    v.body.tail === 'hatch' ? roofEndX + 60 : glassBase + 0.35 * (roofEndX - glassBase),
  );
  const side = dlo(s, { rear, rearTop: rear + (v.body.tail === 'hatch' ? 160 : 260) });
  out.push({ tag: 'dlo', view: 'side', ...side, mat: 'glass', mirror: true, offset: 4, nv: 4 });
  if (
    (v.seats.layout === '4' || v.seats.layout === '5' || v.seats.layout === '7') &&
    v.seats.rows >= 2
  ) {
    const xB = lerp(side.u1, side.u0, 0.46);
    out.push({
      tag: 'b-pillar',
      view: 'side',
      ...pillar(s, xB, 85),
      mat: 'black',
      mirror: true,
      offset: 7,
      nv: 3,
    });
  }
  if (style === 'roadster') {
    out.push({
      tag: 'soft-top',
      view: 'top',
      ...roofPatch(s, glassBase + 10, screenTopX + 20, 2),
      mat: 'fabric',
      offset: 3,
    });
  }

  // ── lamps, grille, bumpers ──
  const faceTop = s.top(xF - 0.04 * c.L);
  const faceBot = s.bottom(xF);
  const hlV = lerp(faceBot, faceTop, 0.74);
  const hlH = clamp(0.065 * W, 70, 150);
  out.push({
    tag: 'headlight',
    view: 'front',
    ...roundRect(0.4 * (W / 2), 0.86 * (W / 2), hlV - hlH / 2, hlV + hlH / 2, hlH * 0.35),
    mat: 'lamp',
    mirror: true,
    offset: 4,
  });
  const pt = v.powertrain;
  const frontEngine = pt.kind === 'ice' && pt.position.startsWith('front');
  if (frontEngine) {
    out.push({
      tag: 'grille',
      view: 'front',
      ...roundRect(
        -0.36 * (W / 2),
        0.36 * (W / 2),
        lerp(faceBot, faceTop, 0.45),
        hlV + hlH * 0.2,
        30,
      ),
      mat: 'grille',
      offset: 3,
    });
    out.push({
      tag: 'intake',
      view: 'front',
      ...roundRect(-0.55 * (W / 2), 0.55 * (W / 2), faceBot + 40, lerp(faceBot, faceTop, 0.3), 30),
      mat: 'grille',
      offset: 3,
    });
  } else {
    // no engine up front: radiator intakes at the corners (mid/rear engines) or a slim slot (EVs)
    if (pt.kind === 'ice') {
      out.push({
        tag: 'intake-side',
        view: 'front',
        ...roundRect(0.5 * (W / 2), 0.88 * (W / 2), faceBot + 30, lerp(faceBot, faceTop, 0.45), 40),
        mat: 'grille',
        mirror: true,
        offset: 3,
      });
    }
    out.push({
      tag: 'intake',
      view: 'front',
      ...roundRect(-0.4 * (W / 2), 0.4 * (W / 2), faceBot + 30, lerp(faceBot, faceTop, 0.22), 25),
      mat: 'grille',
      offset: 3,
    });
  }
  if (pt.kind === 'ice' && pt.position === 'mid') {
    // mid-engine signature: a side scoop feeding the engine bay, ahead of the rear wheel
    const xr = s.c.wheels[1].x + s.c.wheels[1].archR + 60;
    const yb = s.bottom(xr) + 0.3 * (s.belt(xr) - s.bottom(xr));
    const yt = s.belt(xr) - 40;
    out.push({
      tag: 'side-scoop',
      view: 'side',
      ...poly(
        [
          [xr, yb],
          [xr + 330, yt],
        ],
        [
          [xr, yb],
          [xr + 330, yb + 0.35 * (yt - yb)],
        ],
      ),
      mat: 'grille',
      mirror: true,
      offset: 4,
    });
    // engine-cover louvres
    const deckX = lerp(p.cabin[0], xR, 0.45);
    for (let k = 0; k < 4; k++) {
      const x = deckX + 130 - k * 90;
      out.push({
        view: 'top',
        ...roundRect(x - 22, x + 22, -0.22 * W, 0.22 * W, 10),
        mat: 'black',
        offset: 3,
        nv: 4,
        outline: false,
      });
    }
  }
  const tailTop = s.top(xR + 0.05 * c.L);
  const tailBot = s.bottom(xR);
  const tlV = lerp(tailBot, tailTop, 0.8);
  const tlH = clamp(0.05 * W, 60, 120);
  out.push({
    tag: 'taillight',
    view: 'rear',
    ...roundRect(0.46 * (W / 2), 0.9 * (W / 2), tlV - tlH / 2, tlV + tlH / 2, tlH * 0.3),
    mat: 'lampRed',
    mirror: true,
    offset: 4,
  });
  out.push({
    tag: 'diffuser',
    view: 'rear',
    ...roundRect(-0.6 * (W / 2), 0.6 * (W / 2), tailBot + 15, lerp(tailBot, tailTop, 0.18), 25),
    mat: 'black',
    offset: 3,
  });
  return out;
}
