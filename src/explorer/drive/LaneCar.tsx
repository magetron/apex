/**
 * The cars as drawn on the road, beyond the visitor's own 3D model:
 *  - RivalCar: the comparison car, as that real car: its detailed model with a rim in its
 *    colour (DetailedCar.tsx), only its footprint's outline while the model streams in; a car
 *    with no model, the procedural look-alike shell in its colour, rolling and pitching with its
 *    sim (a stop's nose dive drawn deeper, as the timeline's ×5 chip says).
 *  - CarHalo: a thin outline round a car's footprint in its colour, so a car still shows from
 *    far above.
 *  - CarLabel: one small tag per car, its name and its driver's hands and feet, and from the
 *    key moment on one word for what it does; placed on screen beside its car where it stays
 *    inside the part of the view no panel covers and clear of the other car and its tag, so
 *    the two tags never sit on each other, on a car, or under the HUD.
 */
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Camera,
} from 'three';
import type { VehicleSpec } from '../../spec/types';
import { getShell } from '../../vehicle3d/shell/build';
import { driveWindow } from './camera';
import { DetailedRival, fadeSolid, hasDetailed } from './DetailedCar';
import type { ScenarioId } from '../../sim/scenarios';
import type { DriveColors } from './colors';
import { liveVerdict, tagWord } from './freeze';
import { InputGlyph, WHEEL, type Input } from './glyphs';
import { driveCars, drivePlayback, pauseVerdict, shownPitch } from './state';
import { groundScale } from './Tracks';
import { FADED, laneEventTime, type Lane } from './lanes';
import { poseOrigin, type Ground } from './world';

const pt: Ground = { x: 0, z: 0 };
/** a unit tyre, its axis across the car */
const tyre = new CylinderGeometry(1, 1, 1, 20).rotateX(Math.PI / 2);
/** a unit strip lying on the ground, for the halo's sides */
const strip = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/** slip-angle difference (rad) that reads as fully over- or understeering */
const FULL = 0.06;

/** Live balance of a car from its axle slip angles: −1 oversteer … +1 understeer. */
export function balanceOf(lane: Lane): number {
  const st = lane.view;
  if (Math.hypot(st.vx, st.vy) < 3 || Math.abs(st.ay) < 1) return 0;
  return Math.max(-1, Math.min(1, (Math.abs(st.alphaF) - Math.abs(st.alphaR)) / FULL));
}

/**
 * The comparison car: its detailed model in its own paint with a rim in its colour (see
 * DetailedCar), the look-alike shell in its colour while that streams in; its body pitched as
 * drawn (state.ts shownPitch).
 */
export function RivalCar(props: {
  lane: Lane;
  vehicle: VehicleSpec;
  color: string;
  /** its front wheels' steering drawn this many times larger (catching a slide) */
  steerScale?: number;
}) {
  // while its detailed model streams in, only a clean outline of its footprint (the look-alike
  // shell read as a lumpy blob for that moment); the shell only for a car with no model at all
  return (
    <DetailedRival
      {...props}
      fallback={
        hasDetailed(props.vehicle) ? (
          <CarHalo lane={props.lane} color={props.color} />
        ) : (
          <ShellCar {...props} />
        )
      }
    />
  );
}

/** The look-alike shell, in the comparison's colour, on four tyres. */
function ShellCar({
  lane,
  vehicle,
  color,
}: {
  lane: Lane;
  vehicle: VehicleSpec;
  color: string;
  steerScale?: number;
}) {
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const shell = useMemo(() => getShell(vehicle), [vehicle]);
  const mats = useMemo(
    () => ({
      paint: new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
      tyre: new MeshStandardMaterial({ color: '#16191d', roughness: 0.9 }),
    }),
    [color],
  );
  useEffect(
    () => () => {
      mats.paint.dispose();
      mats.tyre.dispose();
    },
    [mats],
  );
  const { p } = lane;
  const R = vehicle.tires.diameterMm / 2000;
  const wheels = useMemo(
    () =>
      [
        [p.L / 2, p.front.track / 2, vehicle.tires.widthFMm],
        [p.L / 2, -p.front.track / 2, vehicle.tires.widthFMm],
        [-p.L / 2, p.rear.track / 2, vehicle.tires.widthRMm],
        [-p.L / 2, -p.rear.track / 2, vehicle.tires.widthRMm],
      ] as const,
    [p, vehicle],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, 0, pt.z);
    g.rotation.set(0, st.yaw, 0);
    // the sprung body only, as the explorer does for the visitor's car
    body.current?.rotation.set(st.roll, 0, shownPitch(st.pitch), 'YXZ');
    // faded out while it is (nearly) on car A (Lane.drawn)
    g.visible = lane.drawn > FADED;
    fadeSolid(mats.paint, lane.drawn);
    fadeSolid(mats.tyre, lane.drawn);
  });

  return (
    <group ref={group}>
      <group ref={body}>
        {/* the shell's frame has the front axle at its origin; the pose is the wheelbase middle */}
        <group position={[p.L / 2, 0, 0]}>
          <mesh geometry={shell.body} material={mats.paint} castShadow />
          <mesh geometry={shell.wells} material={mats.tyre} />
        </group>
      </group>
      {wheels.map(([x, z, w], i) => (
        <mesh
          key={i}
          geometry={tyre}
          material={mats.tyre}
          position={[x, R, z]}
          scale={[R, R, w / 1000]}
          castShadow
        />
      ))}
    </group>
  );
}

/** A thin outline round a car's footprint, never thinner than a few pixels on screen. */
export function CarHalo({ lane, color }: { lane: Lane; color: string }) {
  const group = useRef<Group>(null);
  const parts = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -60,
    });
    const sides = [0, 1, 2, 3].map(() => {
      const m = new Mesh(strip, mat);
      m.renderOrder = 4;
      m.frustumCulled = false;
      return m;
    });
    return { mat, sides };
  }, [color]);
  useEffect(() => () => parts.mat.dispose(), [parts]);
  const { p } = lane;
  const { length, width, overhangF } = p.dims;
  const cx = p.L / 2 + overhangF - length / 2;

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, 0.015, pt.z);
    g.rotation.set(0, st.yaw, 0);
    g.visible = lane.drawn > FADED;
    parts.mat.opacity = 0.9 * lane.drawn;
    const th = Math.max(0.07, 2.5 * groundScale.mPerPx);
    const gap = 0.12 + th / 2;
    const hl = length / 2 + gap;
    const hw = width / 2 + gap;
    const [front, back, left, right] = parts.sides;
    front.position.set(cx + hl, 0, 0);
    front.scale.set(th, 1, 2 * hw + th);
    back.position.set(cx - hl, 0, 0);
    back.scale.set(th, 1, 2 * hw + th);
    left.position.set(cx, 0, -hw);
    left.scale.set(2 * hl, 1, th);
    right.position.set(cx, 0, hw);
    right.scale.set(2 * hl, 1, th);
  });

  return (
    <group ref={group}>
      {parts.sides.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}

/** A box on screen (px). */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const box = (): Box => ({ x0: 0, y0: 0, x1: 0, y1: 0 });

/**
 * Each car's box on screen and its tag's, as last placed (0 = the visitor's car, 1 = the
 * comparison): a tag keeps clear of the other car and of the other tag.
 */
const onScreen = [0, 1].map(() => ({ car: box(), tag: box(), tagOn: false }));
const v3 = new Vector3();
/** px between a tag and what it keeps clear of; the label's own CSS lifts it LIFT px */
const GAP = 8;
const LIFT = 22;

/** A car's footprint and roof corners, projected: its box on screen (px). */
function carBox(lane: Lane, camera: Camera, w: number, h: number, out: Box): Box {
  const { p, view: st } = lane;
  poseOrigin(p, st, pt);
  const { length, width, height, overhangF } = p.dims;
  const cx = p.L / 2 + overhangF - length / 2;
  const c = Math.cos(st.yaw);
  const s = Math.sin(st.yaw);
  out.x0 = out.y0 = Infinity;
  out.x1 = out.y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const lx = cx + (i & 1 ? 0.5 : -0.5) * length;
    const lz = (i & 2 ? 0.5 : -0.5) * width;
    // turned by the car's yaw about +Y, as the halo and the car are drawn
    v3.set(pt.x + c * lx + s * lz, i & 4 ? height : 0, pt.z - s * lx + c * lz).project(camera);
    const x = (v3.x + 1) * 0.5 * w;
    const y = (1 - v3.y) * 0.5 * h;
    out.x0 = Math.min(out.x0, x);
    out.x1 = Math.max(out.x1, x);
    out.y0 = Math.min(out.y0, y);
    out.y1 = Math.max(out.y1, y);
  }
  return out;
}

/** The part of the view the HUD leaves free, in px (into `free`). */
function freeBox(w: number, h: number): Box {
  const win = driveWindow.win;
  free.x0 = ((win[0] + 1) / 2) * w + 4;
  free.x1 = ((win[2] + 1) / 2) * w - 4;
  free.y0 = ((1 - win[3]) / 2) * h + 4;
  free.y1 = ((1 - win[1]) / 2) * h - 4;
  return free;
}

const hits = (a: Box, b: Box) =>
  a.x0 < b.x1 + 2 && b.x0 < a.x1 + 2 && a.y0 < b.y1 + 2 && b.y0 < a.y1 + 2;
const within = (a: Box, b: Box) =>
  a.x0 >= b.x0 &&
  a.x1 <= b.x1 &&
  a.y0 >= b.y0 &&
  a.y1 <= b.y1 &&
  // and clear of the breadcrumb at the top left
  !(a.x0 < driveWindow.crumb.x1 && a.y0 < driveWindow.crumb.y1);

type Side = 'above' | 'below' | 'left' | 'right';
/** the sides to try, by which way is away from the other car: above first, then away */
const ORDER: Record<Side, readonly Side[]> = {
  above: ['above', 'below', 'right', 'left'],
  below: ['above', 'below', 'right', 'left'],
  left: ['above', 'left', 'below', 'right'],
  right: ['above', 'right', 'below', 'left'],
};
const cand = box();
const free = box();

/** The tag (`tw` × `th` px) on `side` of the car box `me`. */
function place(me: Box, side: Side, tw: number, th: number, out: Box): Box {
  const mx = (me.x0 + me.x1) / 2;
  const my = (me.y0 + me.y1) / 2;
  if (side === 'above' || side === 'below') {
    out.x0 = mx - tw / 2;
    out.y0 = side === 'above' ? me.y0 - GAP - th : me.y1 + GAP;
  } else {
    out.x0 = side === 'left' ? me.x0 - GAP - tw : me.x1 + GAP;
    out.y0 = my - th / 2;
  }
  out.x1 = out.x0 + tw;
  out.y1 = out.y0 + th;
  return out;
}

/**
 * Where a car's tag goes on screen: above the car if that keeps it inside the free part of the
 * view (never under a panel) and clear of the other car and its tag, else on the side away from
 * the other car, below, or the remaining side; failing all of them, above, pulled inside the
 * view. Writes the chosen box to `out` and says which side it is on.
 */
function tagBox(slot: number, tw: number, th: number, out: Box): Side {
  const me = onScreen[slot].car;
  const other = onScreen[1 - slot];
  const dx = (me.x0 + me.x1 - other.car.x0 - other.car.x1) / 2;
  const dy = (me.y0 + me.y1 - other.car.y0 - other.car.y1) / 2;
  const away: Side =
    Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'below' : 'above';
  const order = ORDER[away];
  // first clear of the other car and its tag; failing that (the cars on top of each other on
  // screen), clear of its tag at least: two tags never overlap
  for (let pass = 0; pass < 2; pass++)
    for (let i = 0; i < order.length; i++) {
      place(me, order[i], tw, th, cand);
      if (!within(cand, free) || (pass === 0 && hits(cand, other.car))) continue;
      if (other.tagOn && hits(cand, other.tag)) continue;
      Object.assign(out, cand);
      return order[i];
    }
  place(me, 'above', tw, th, out);
  const sx = Math.max(0, free.x0 - out.x0) - Math.max(0, out.x1 - free.x1);
  let sy = Math.max(0, free.y0 - out.y0) - Math.max(0, out.y1 - free.y1);
  // still on the other tag: stack it just under (or over) that one
  cand.x0 = out.x0 + sx;
  cand.x1 = out.x1 + sx;
  cand.y0 = out.y0 + sy;
  cand.y1 = out.y1 + sy;
  if (other.tagOn && hits(cand, other.tag)) {
    const below = other.tag.y1 + 4 - out.y0;
    sy = out.y1 + below <= free.y1 ? below : other.tag.y0 - 4 - out.y1;
  }
  out.x0 += sx;
  out.x1 += sx;
  out.y0 += sy;
  out.y1 += sy;
  return 'above';
}

/** the tag words that say an end let go, or it spun: red, as its rings */
const OUT_WORDS = ['front out', 'rear out', 'spun'];
/** a jump in time this big (s of sim) is a seek, not a frame */
const SEEK_JUMP = 0.3;
/** steering-wheel turns per road-wheel turn, for the glyph of the wheel */
const STEER_RATIO = 15;
/** a driver's action pops over the car at its moment and shows this long (s of sim), fading
 *  over the last part of it */
const ACT_S = 1.6;
const ACT_FADE = 0.5;

/**
 * One tag per car, placed on screen beside it (see tagBox): its name; at the moment its driver
 * acts, that action as one large glyph (the foot off the gas, the gas down, the brake, the wheel
 * turning), popping up and fading; catching a slide, the steering wheel large and turning through
 * the key moment; from the key moment on, the one word for how its run comes out (liveVerdict:
 * red for an end out or a spin, the recovery colour for a catch). Car A itself changed is a
 * dashed tag with no name: its dot, what it leaves out crossed out, and its word. Written straight
 * to the DOM each frame, never re-rendered.
 */
export function CarLabel({
  lane,
  other,
  slot = 0,
  t,
  name,
  color,
  id,
  colors,
  acts = null,
  twin = false,
  leaves = null,
}: {
  lane: Lane;
  /** the other car on the road, whose box and tag this one keeps clear of */
  other?: Lane;
  /** 0 = the visitor's car, 1 = the comparison */
  slot?: 0 | 1;
  t: { now: number };
  name?: string;
  color: string;
  /** the question (the tag's word) */
  id: ScenarioId;
  /** the scene's colours: a slide's red, opposite lock's colour (the arrow on the wheels) */
  colors: DriveColors;
  /** what its driver does at its moment (popped over it), if anything */
  acts?: Input | null;
  /** this is car A itself, changed (drawn dashed, a ghost of it) */
  twin?: boolean;
  /** …without this action (crossed out) */
  leaves?: Input | null;
}) {
  const tag = useRef<Group>(null);
  const el = useRef<HTMLDivElement>(null);
  const out = useRef<HTMLSpanElement>(null);
  const lead = useRef<HTMLSpanElement>(null);
  const act = useRef<HTMLSpanElement>(null);
  const wheel = useRef<HTMLSpanElement>(null);
  const shown = useRef({ word: '', act: false, lock: false });
  /** the playhead last frame (a seek is a jump in it), and when this car's driver acts (its
   *  event, found once its run is recorded) */
  const was = useRef({ t: -1, event: NaN, epoch: -1 });
  /** the tag's size (px), measured again when its text changes */
  const size = useRef({ w: 0, h: 0, stale: true });
  const { p } = lane;
  const { height } = p.dims;

  const at = useMemo(() => {
    // drei compares each new position with the last one it got: two arrays, in turn
    const pair = [
      [0, 0],
      [0, 0],
    ];
    let k = 0;
    let hidden = false;
    let side: Side | '' = '';
    const leader = { len: -1, ang: 0 };
    const chosen = box();
    return (_: unknown, camera: Camera, view: { width: number; height: number }) => {
      const { width: w, height: h } = view;
      const me = onScreen[slot];
      carBox(lane, camera, w, h, me.car);
      if (other) carBox(other, camera, w, h, onScreen[1 - slot].car);
      const d = el.current;
      const sz = size.current;
      if (d && (sz.stale || sz.w === 0)) {
        sz.w = d.offsetWidth;
        sz.h = d.offsetHeight;
        sz.stale = false;
      }
      // a car out of the free part of the view (behind a panel, or off the screen) has no tag
      const gone = !hits(me.car, freeBox(w, h));
      if (d && gone !== hidden) {
        hidden = gone;
        d.style.visibility = gone ? 'hidden' : '';
      }
      me.tagOn = !!d && !gone && d.style.display !== 'none' && sz.w > 0;
      const now = tagBox(slot, sz.w, sz.h, chosen);
      if (d && now !== side) {
        side = now;
        d.dataset.side = now;
      }
      Object.assign(me.tag, chosen);
      // a leader from the tag's edge to its own car, whichever side the tag is on
      const ln = lead.current;
      if (ln && sz.w > 0) {
        const hw = sz.w / 2;
        const hh = sz.h / 2;
        const dx = (me.car.x0 + me.car.x1) / 2 - (chosen.x0 + chosen.x1) / 2;
        const dy = (me.car.y0 + me.car.y1) / 2 - (chosen.y0 + chosen.y1) / 2;
        const len = Math.hypot(dx, dy);
        const ux = len > 0 ? dx / len : 0;
        const uy = len > 0 ? dy / len : 1;
        const edge = Math.min(ux ? hw / Math.abs(ux) : Infinity, uy ? hh / Math.abs(uy) : Infinity);
        // to the near side of the car, not its middle
        const trim = 0.3 * Math.min(me.car.x1 - me.car.x0, me.car.y1 - me.car.y0);
        const show = Math.max(0, len - edge - trim);
        const ang = Math.atan2(uy, ux);
        if (Math.abs(show - leader.len) > 0.5 || Math.abs(ang - leader.ang) > 0.01) {
          leader.len = show;
          leader.ang = ang;
          ln.style.left = `${hw + ux * edge}px`;
          ln.style.top = `${hh + uy * edge}px`;
          ln.style.width = `${show}px`;
          ln.style.transform = `rotate(${ang}rad)`;
        }
      }
      k = 1 - k;
      const r = pair[k];
      // the label's CSS centres it on the point and lifts it LIFT px above
      r[0] = (chosen.x0 + chosen.x1) / 2;
      r[1] = chosen.y1 + LIFT;
      return r;
    };
  }, [lane, other, slot]);
  useEffect(
    () => () => {
      onScreen[slot].tagOn = false;
    },
    [slot],
  );

  // ahead of drei's own frame for the tag, which reads where the car is
  useFrame(() => {
    const g = tag.current;
    if (!g) return;
    const st = lane.view;
    poseOrigin(p, st, pt);
    g.position.set(pt.x, height, pt.z);
    const c = driveCars[slot];
    const now = t.now;
    const s = shown.current;

    const w = was.current;
    // a jump in time (a seek): measured and placed afresh
    if (Math.abs(now - w.t) > SEEK_JUMP) size.current.stale = true;
    w.t = now;
    // when its driver acts: its event, once its run is recorded
    if (w.epoch !== lane.rec.epoch && lane.rec.count > 1) {
      w.epoch = lane.rec.epoch;
      w.event = laneEventTime(lane);
    }
    // its action, popped over it: catching a slide, the wheel through the key moment; else from
    // its event, fading
    const catching = acts === 'wheel' && id === 'catch';
    const since = now - w.event;
    const on = !!acts && (catching ? drivePlayback.keyOn : since >= 0 && since < ACT_S);
    if (on !== s.act) {
      s.act = on;
      const a = act.current;
      if (a) {
        a.hidden = !on;
        // the pop, played again each time it appears
        a.classList.remove('is-pop');
        if (on) {
          void a.offsetWidth;
          a.classList.add('is-pop');
        }
      }
      size.current.stale = true;
    }
    if (on && act.current)
      act.current.style.opacity = catching
        ? '1'
        : Math.min(1, (ACT_S - since) / ACT_FADE).toFixed(2);
    if (on && wheel.current) {
      const deg = Math.max(-540, Math.min(540, -c.steerDeg * STEER_RATIO));
      wheel.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
      // opposite lock (steering out of the turn, into a slide) in the correction's colour
      const lock = c.slid && c.turnSign !== 0 && c.steerDeg * c.turnSign < -1;
      if (lock !== s.lock) {
        s.lock = lock;
        act.current?.classList.toggle('is-lock', lock);
      }
    }

    // the one word, from the key moment on: how its run comes out (an end out stays out)
    const word = tagWord(id, liveVerdict(id, lane, st, now, pauseVerdict(now, slot)));
    if (word !== s.word) {
      s.word = word;
      if (out.current) {
        out.current.textContent = word;
        out.current.hidden = !word;
        out.current.classList.toggle('is-out', OUT_WORDS.includes(word));
        out.current.classList.toggle('is-caught', word === 'catching' || word === 'caught');
      }
      size.current.stale = true;
    }
  }, -1);

  return (
    <group ref={tag}>
      <Html zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }} calculatePosition={at}>
        <div
          ref={el}
          className={`apx-label apx-drive-carlabel${twin ? ' is-twin' : ''}`}
          style={
            { '--sys': color, '--steer': colors.steer, '--slide': colors.slide } as CSSProperties
          }
        >
          <span className="apx-label__dot" />
          {/* car A itself, changed, says only what it leaves out */}
          {name && !twin && <span className="apx-drive-carlabel__name">{name}</span>}
          {leaves && (
            <span className="apx-drive-carlabel__leaves">
              <InputGlyph input={leaves} off fill={0} />
            </span>
          )}
          {acts && (
            <span ref={act} className="apx-drive-act" hidden aria-hidden>
              {acts === 'wheel' ? (
                <span className="apx-drive-hands__wheel">
                  <span ref={wheel}>{WHEEL}</span>
                </span>
              ) : (
                <InputGlyph input={acts} fill={0.6} />
              )}
            </span>
          )}
          <span ref={out} className="apx-drive-carlabel__out" hidden />
          <span ref={lead} className="apx-drive-carlabel__lead" aria-hidden />
        </div>
      </Html>
    </group>
  );
}
