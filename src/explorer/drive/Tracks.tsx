/**
 * What a car leaves on the road, built from its recording and shown up to the playhead (so a
 * replay or a scrub back draws exactly what had happened by then):
 *  - the line it drove (its centre of gravity), in its own colour: the visitor's car neutral,
 *    the comparison car its accent;
 *  - for the visitor's car, four tyre marks: quiet grey while that end of the car grips, red
 *    once it has let go (red means nothing else in the scene). Front marks turning red =
 *    understeer, rear marks = oversteer.
 * Preallocated; nothing is allocated per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial } from 'three';
import { axleUse, createState, FL, RL } from '../../sim/model';
import { offsetPoint, type PathPoint } from '../../sim/scenarios';
import type { DriveColors } from './colors';
import type { KeyMoment } from './key';
import type { Lane } from './lanes';
import { wheelPoint, type Ground } from './world';

const MAX = 3000;

/** grip in use from which a tyre or axle reads as letting go: red from here… */
const SLIDE_FROM = 0.96;
/** …fully red here (the let-go threshold of lanes.ts) */
const SLIDE_AT = 0.985;

/** Colour for a tyre or axle using `use` (0..1+) of its grip: grey, then red as it lets go. */
export function gripColor(out: Color, use: number, c: { grip: Color; slide: Color }): Color {
  if (use < SLIDE_FROM) return out.copy(c.grip);
  return out.lerpColors(c.grip, c.slide, Math.min(1, (use - SLIDE_FROM) / (SLIDE_AT - SLIDE_FROM)));
}

/** A flat ribbon laid point by point; each point remembers when it was laid. */
export class Ribbon {
  readonly geo = new BufferGeometry();
  private readonly pos = new Float32Array(MAX * 2 * 3);
  private readonly col: Float32Array | null;
  private readonly time = new Float32Array(MAX);
  /** each point's centre and unit sideways direction (x, z, ux, uz), to redraw at a new width */
  private readonly mid = new Float32Array(MAX * 4);
  private count = 0;
  private shown = -1;
  private lx = 0;
  private lz = 0;

  constructor(
    private half: number,
    private readonly y: number,
    private readonly spacing: number,
    colored: boolean,
  ) {
    const idx = new Uint32Array((MAX - 1) * 6);
    for (let i = 0; i < MAX - 1; i++) {
      const v = i * 2;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
    this.geo.setIndex(new BufferAttribute(idx, 1));
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.col = colored ? new Float32Array(MAX * 2 * 3) : null;
    if (this.col) this.geo.setAttribute('color', new BufferAttribute(this.col, 3));
    this.geo.setDrawRange(0, 0);
  }

  clear() {
    this.count = 0;
    this.shown = -1;
    this.geo.setDrawRange(0, 0);
  }

  /** Lay a point at time t if it is far enough from the last one. */
  add(t: number, x: number, z: number, c?: Color) {
    if (this.count >= MAX) return;
    const dx = x - this.lx;
    const dz = z - this.lz;
    const d = Math.hypot(dx, dz);
    if (this.count > 0 && d < this.spacing) return;
    // sideways to the direction laid (the first point has none yet: a sliver)
    const m = this.count * 4;
    this.mid[m] = x;
    this.mid[m + 1] = z;
    this.mid[m + 2] = this.count > 0 ? -dz / d : 0;
    this.mid[m + 3] = this.count > 0 ? dx / d : 0;
    this.place(this.count);
    const o = this.count * 6;
    if (this.col && c)
      for (let k = 0; k < 2; k++) {
        this.col[o + 3 * k] = c.r;
        this.col[o + 3 * k + 1] = c.g;
        this.col[o + 3 * k + 2] = c.b;
      }
    this.time[this.count] = t;
    this.count++;
    this.lx = x;
    this.lz = z;
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
    if (this.col) (this.geo.attributes.color as BufferAttribute).needsUpdate = true;
    if (this.count === 2) this.geo.computeBoundingSphere();
  }

  private place(i: number) {
    const { pos, mid, y, half } = this;
    const m = i * 4;
    const o = i * 6;
    pos[o] = mid[m] + mid[m + 2] * half;
    pos[o + 1] = y;
    pos[o + 2] = mid[m + 1] + mid[m + 3] * half;
    pos[o + 3] = mid[m] - mid[m + 2] * half;
    pos[o + 4] = y;
    pos[o + 5] = mid[m + 1] - mid[m + 3] * half;
  }

  /** Redraw at another half-width (m), e.g. thicker when seen from far above. */
  setHalf(half: number) {
    this.half = half;
    for (let i = 0; i < this.count; i++) this.place(i);
    (this.geo.attributes.position as BufferAttribute).needsUpdate = true;
  }

  get halfWidth() {
    return this.half;
  }

  /** Show what was laid up to time t. */
  showUntil(t: number) {
    let n = this.count;
    while (n > 0 && this.time[n - 1] > t + 1e-6) n--;
    if (n !== this.shown) {
      this.shown = n;
      this.geo.setDrawRange(0, Math.max(0, (n - 1) * 6));
    }
  }
}

const scratch = createState();
const pt: Ground = { x: 0, z: 0 };
const tmp = new Color();

/**
 * Keep a lane's ribbons in step with its recording: lay points for frames recorded since last
 * time (or start over after a reset), then show them up to the playhead.
 */
function follow(
  lane: Lane,
  state: { done: number; seen: number },
  clear: () => void,
  lay: (t: number) => void,
) {
  const rec = lane.rec;
  if (rec.count < state.done || state.seen !== rec.epoch) {
    clear();
    state.done = 0;
    state.seen = rec.epoch;
  }
  for (; state.done < rec.count; state.done++) {
    rec.frame(state.done, scratch);
    // onto the car's own lane (the comparison car runs beside the visitor's)
    lane.place(scratch, rec.sAt(state.done));
    lay(scratch.t);
  }
}

/** How big a screen pixel is on the ground where the camera looks (m), from the camera hook. */
export const groundScale = { mPerPx: 0.01 };

/** The line a car drove (its CG), in its colour; never thinner than a few pixels on screen. */
export function PathLine({
  lane,
  t,
  color,
  width = 0.16,
}: {
  lane: Lane;
  t: { now: number };
  color: string;
  width?: number;
}) {
  const parts = useMemo(() => {
    const ribbon = new Ribbon(width / 2, 0.012, 0.25, false);
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      // laid in either direction, so seen from above either way round
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -50,
    });
    const mesh = new Mesh(ribbon.geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return { ribbon, material, mesh, state: { done: 0, seen: -1 } };
  }, [color, width]);
  useEffect(
    () => () => {
      parts.ribbon.geo.dispose();
      parts.material.dispose();
    },
    [parts],
  );
  useFrame(() => {
    const { ribbon } = parts;
    const half = Math.max(width, 3 * groundScale.mPerPx) / 2;
    if (Math.abs(half - ribbon.halfWidth) > 0.15 * ribbon.halfWidth) ribbon.setHalf(half);
    follow(
      lane,
      parts.state,
      () => ribbon.clear(),
      (time) => ribbon.add(time, scratch.x, -scratch.n),
    );
    // up to where the car is drawn (car B just behind on car A's line)
    ribbon.showUntil(lane.drawnTime(t.now));
  });
  return <primitive object={parts.mesh} />;
}

/** Four tyre marks coloured by grip in use. */
export function TyreMarks({
  lane,
  t,
  colors,
  sideways = true,
}: {
  lane: Lane;
  t: { now: number };
  colors: DriveColors;
  /** grip running out sideways is letting go (red); a straight ABS stop works every tyre at its
   *  limit without anything letting go, so its marks stay grey */
  sideways?: boolean;
}) {
  const parts = useMemo(() => {
    const ribbons = [0, 1, 2, 3].map(() => new Ribbon(0.07, 0.008, 0.3, true));
    const material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      // laid in either direction, so seen from above either way round
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      // seen from straight above a flat polygon has no depth slope: the factor alone does
      // nothing there, and these 1 cm layers would z-fight from the overhead view
      polygonOffsetUnits: -40,
    });
    const meshes = ribbons.map((r) => {
      const m = new Mesh(r.geo, material);
      m.frustumCulled = false;
      m.renderOrder = 2;
      return m;
    });
    return { ribbons, material, meshes, state: { done: 0, seen: -1 } };
  }, []);
  useEffect(
    () => () => {
      parts.ribbons.forEach((r) => r.geo.dispose());
      parts.material.dispose();
    },
    [parts],
  );
  const palette = useMemo(
    () => ({ grip: new Color(colors.grip), slide: new Color(colors.slide) }),
    [colors],
  );
  useFrame(() => {
    follow(
      lane,
      parts.state,
      () => parts.ribbons.forEach((r) => r.clear()),
      (time) => {
        if (Math.hypot(scratch.vx, scratch.vy) < 0.3) return;
        // coloured by the axle, not the tyre: red says that end let go, as the wedges do
        const useF = sideways ? axleUse(scratch, FL) : 0;
        const useR = sideways ? axleUse(scratch, RL) : 0;
        for (let i = 0; i < 4; i++) {
          wheelPoint(lane.p, scratch, i, pt);
          parts.ribbons[i].add(time, pt.x, pt.z, gripColor(tmp, i < 2 ? useF : useR, palette));
        }
      },
    );
    for (const r of parts.ribbons) r.showUntil(t.now);
  });
  return (
    <group>
      {parts.meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

/** the gap between two lines is drawn every this far along the road (m), at most this long */
const GAP_STEP = 0.4;
const GAP_MAX = 400;

/** How far off the plan's path a lane was (m, + = left) along it, from its recording. */
function offsets(lane: Lane): { s: Float32Array; e: Float32Array } {
  const rec = lane.rec;
  const s = new Float32Array(rec.count);
  const e = new Float32Array(rec.count);
  for (let i = 0; i < rec.count; i++) {
    s[i] = rec.sAt(i);
    e[i] = rec.errAt(i);
  }
  return { s, e };
}

/** The offset at arc length x, between the recorded frames around it (s rising). */
function offsetAt(o: { s: Float32Array; e: Float32Array }, x: number): number {
  const { s, e } = o;
  let lo = 0;
  let hi = s.length - 1;
  if (hi < 0) return 0;
  if (x <= s[0]) return e[0];
  if (x >= s[hi]) return e[hi];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] <= x) lo = mid;
    else hi = mid;
  }
  const w = s[hi] > s[lo] ? (x - s[lo]) / (s[hi] - s[lo]) : 0;
  return e[lo] + (e[hi] - e[lo]) * w;
}

/**
 * Where two cars on the same line part: the ground between their two lines, filled in car A's
 * colour from the driver's action on, growing as they drive. A car braked into a turn shows its
 * line running inside the other's; one that runs wide, outside. Both cars share the plan's path
 * (car B a ghost on car A's line), so each one's offset from it is laid side by side.
 */
export function PathGap({
  a,
  b,
  t,
  focus,
  color,
}: {
  a: Lane;
  b: Lane;
  t: { now: number };
  /** the key moment: the gap is drawn from the driver's action to the end of what it led to */
  focus: { key: KeyMoment | null };
  color: string;
}) {
  const parts = useMemo(() => {
    const geo = new BufferGeometry();
    const pos = new Float32Array(GAP_MAX * 2 * 3);
    const idx = new Uint32Array((GAP_MAX - 1) * 6);
    for (let i = 0; i < GAP_MAX - 1; i++) {
      const v = i * 2;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
    }
    geo.setIndex(new BufferAttribute(idx, 1));
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -40,
    });
    const mesh = new Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return { geo, pos, material, mesh, built: { n: 0, s0: 0, ready: false } };
  }, [color]);
  useEffect(
    () => () => {
      parts.geo.dispose();
      parts.material.dispose();
    },
    [parts],
  );
  useFrame(() => {
    const { built } = parts;
    const key = focus.key;
    if (!key) return;
    const from = key.t;
    const to = key.end;
    // built once both recordings reach past the stretch (scripted runs are whole at once)
    if (!built.ready) {
      if (a.head < to || b.head < to) return;
      built.ready = true;
      const oa = offsets(a);
      const ob = offsets(b);
      const s0 = a.rec.sAtTime(from);
      const s1 = Math.min(a.rec.sAtTime(to), b.rec.sAtTime(to));
      const path = a.plan.path;
      let n = 0;
      for (let x = s0; x <= s1 && n < GAP_MAX; x += GAP_STEP, n++) {
        const [ax, an] = offsetPoint(path, x, offsetAt(oa, x), gp);
        const [bx, bn] = offsetPoint(path, x, offsetAt(ob, x), gp);
        parts.pos.set([ax, 0.008, -an, bx, 0.008, -bn], n * 6);
      }
      (parts.geo.attributes.position as BufferAttribute).needsUpdate = true;
      parts.geo.computeBoundingSphere();
      built.n = n;
      built.s0 = s0;
    }
    // as far as both cars have got
    const sNow = Math.min(a.rec.sAtTime(t.now), b.rec.sAtTime(t.now));
    const k = t.now < from ? 0 : Math.min(built.n, Math.floor((sNow - built.s0) / GAP_STEP) + 1);
    parts.geo.setDrawRange(0, Math.max(0, k - 1) * 6);
  });
  return <primitive object={parts.mesh} />;
}
const gp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
