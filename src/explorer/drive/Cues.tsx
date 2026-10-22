/**
 * The cause, drawn under and beside the cars, with as few marks as read without a key:
 *  - GripRings: one ring round each tyre, its colour the grip its end of the car is using:
 *    green with grip to spare, amber near the limit, red (pulsing) once that end has let go, the
 *    one thing red means. (The load moving between the axles shows as the body's pitch.)
 *  - TwinPath: braking into a turn, where the same car at the same speed goes without the brake,
 *    dotted on the road as it goes: the braked car runs inside it.
 *  - CatchMarks: catching a slide, where the front wheels point (their angle drawn SHOWN times)
 *    against where the front of the car goes.
 * Preallocated; nothing is allocated per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Shape,
  ShapeGeometry,
} from 'three';
import { axleUse, createState, FL, RL } from '../../sim/model';
import { SCENARIOS } from '../../sim/scenarios';
import type { DriveColors } from './colors';
import { backInGrip, useFreeze } from './freeze';
import { FADED, laneEventTime, type Lane } from './lanes';
import { drivePlayback, shownSteer, SHOWN } from './state';
import { wheelPoint, type Ground } from './world';

/** each ring round its tyre's contact patch (m): wide enough to show past the tyre */
const ring = new RingGeometry(0.56, 0.7, 48).rotateX(-Math.PI / 2);
/** grip in use from which a ring turns amber, and is amber */
const AMBER_FROM = 0.5;
const AMBER_AT = 0.85;
const pt: Ground = { x: 0, z: 0 };

/**
 * A ring's colour for grip in use `use` (0..1+): green with grip to spare, turning amber as it
 * nears the limit; red only for an end that has let go (`slid`: the same let-go as the tag's
 * word and the picture's, lanes.ts), so a front at 97% beside a rear sliding reads as the rear.
 */
export function ringColor(
  out: Color,
  use: number,
  c: { ok: Color; limit: Color; slide: Color },
  slid = false,
): Color {
  if (slid) return out.copy(c.slide);
  if (use < AMBER_FROM) return out.copy(c.ok);
  if (use < AMBER_AT)
    return out.lerpColors(c.ok, c.limit, (use - AMBER_FROM) / (AMBER_AT - AMBER_FROM));
  return out.copy(c.limit);
}

/** Round each of a car's tyres, its ring, coloured by the grip its end is using (see above). */
export function GripRings({
  lane,
  t,
  colors,
}: {
  lane: Lane;
  t: { now: number };
  colors: DriveColors;
}) {
  const parts = useMemo(() => {
    // one colour per axle (its two tyres share the axle's grip in use)
    const mats = [0, 1].map(
      () =>
        new MeshBasicMaterial({
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -5,
          polygonOffsetUnits: -50,
        }),
    );
    const wheels = [0, 1, 2, 3].map((i) => {
      const m = new Mesh(ring, mats[i < 2 ? 0 : 1]);
      m.position.y = 0.02;
      m.renderOrder = 4;
      m.frustumCulled = false;
      return m;
    });
    const root = new Group();
    root.add(...wheels);
    const palette = {
      ok: new Color(colors.ok),
      limit: new Color(colors.limit),
      slide: new Color(colors.slide),
    };
    return { root, wheels, mats, palette };
  }, [colors]);
  useEffect(() => () => parts.mats.forEach((m) => m.dispose()), [parts]);

  useFrame(({ clock }) => {
    const { p, view: st } = lane;
    for (let i = 0; i < 4; i++) {
      wheelPoint(p, st, i, pt);
      parts.wheels[i].position.x = pt.x;
      parts.wheels[i].position.z = pt.z;
    }
    const moving = Math.hypot(st.vx, st.vy) > 0.5;
    // the end that let go, from when it shows until the car grips again (or for good, spun)
    const lg = lane.letGoBy(t.now);
    const out = st.spun ? 'both' : lg && !backInGrip(st) ? lg.axle : null;
    for (let k = 0; k < 2; k++) {
      const use = moving ? axleUse(st, k === 0 ? FL : RL) : 0;
      const slid = out === 'both' || out === (k === 0 ? 'front' : 'rear');
      ringColor(parts.mats[k].color, use, parts.palette, slid);
      // sliding, it pulses, so a red ring is never missed; faded with its car (Lane.drawn)
      parts.mats[k].opacity =
        (slid ? 0.7 + 0.3 * Math.sin(clock.elapsedTime * 9) : 0.95) * lane.drawn;
    }
    parts.root.visible = lane.drawn > FADED;
  });

  return <primitive object={parts.root} />;
}

// ── braking into a turn: where the same car at the same speed goes without the brake ────────

const dot = new CircleGeometry(0.15, 12).rotateX(-Math.PI / 2);
/** the dots this far apart along the path (m), and at most this many */
const DOT_EVERY = 0.75;
const DOT_MAX = 400;
/** dotted from the brake to this long after its held wheel (s) */
const DOT_AFTER = 0.5;
const scan = createState();
const m4 = new Matrix4();

/**
 * Braking into a turn, car B is no car at all: only where the same car at the same speed goes
 * without the brake (the speed-matched line, twin.ts), dotted on the road in its colour, the whole
 * of it from the moment the brake goes on: the braked car is seen running inside it. Built once
 * per run.
 */
export function TwinPath({ lane, t, color }: { lane: Lane; t: { now: number }; color: string }) {
  const parts = useMemo(() => {
    const mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -50,
    });
    const mesh = new InstancedMesh(dot, mat, DOT_MAX);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return { mesh, mat, times: new Float32Array(DOT_MAX), n: 0, seen: -1 };
  }, [color]);
  useEffect(() => () => parts.mat.dispose(), [parts]);

  useFrame(() => {
    const rec = lane.rec;
    // laid once the run is recorded (again after a restart)
    if (parts.seen !== rec.epoch && rec.count > 1) {
      parts.seen = rec.epoch;
      parts.n = 0;
      const te = laneEventTime(lane);
      const hold = SCENARIOS[lane.plan.id].holdS ?? 1;
      if (Number.isFinite(te)) {
        let lx = NaN;
        let lz = NaN;
        for (let i = rec.indexAt(te); i < rec.count && parts.n < DOT_MAX; i++) {
          const t = rec.get(i, 't');
          if (t > te + hold + DOT_AFTER) break;
          rec.frame(i, scan);
          lane.place(scan, rec.sAt(i));
          const x = scan.x;
          const z = -scan.n;
          if (Number.isFinite(lx) && Math.hypot(x - lx, z - lz) < DOT_EVERY) continue;
          lx = x;
          lz = z;
          m4.makeTranslation(x, 0.02, z);
          parts.mesh.setMatrixAt(parts.n, m4);
          parts.times[parts.n++] = t;
        }
        parts.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    // all of it from the brake on: the braked car is seen running inside it as it goes
    parts.mesh.count = parts.n > 0 && t.now >= parts.times[0] ? parts.n : 0;
  });

  return <primitive object={parts.mesh} />;
}

// ── catching a slide: the front wheels against the way the front goes ──────────────────────

const bar = new PlaneGeometry(1, 0.14).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
const tipShape = new Shape();
tipShape.moveTo(0, -0.32);
tipShape.lineTo(0.55, 0);
tipShape.lineTo(0, 0.32);
tipShape.closePath();
const tip = new ShapeGeometry(tipShape).rotateX(-Math.PI / 2);
/** the marks' length ahead of the front axle (m) */
const MARK_LEN = 3.4;

/**
 * Catching a slide, from the front axle: a bright line where the front wheels point (their angle
 * drawn SHOWN times, as on the car) and an arrow where the front of the car is going. Opposite
 * lock swings the line round towards the arrow. Drawn over the car through the key moment.
 */
export function CatchMarks({ lane, colors }: { lane: Lane; colors: DriveColors }) {
  const parts = useMemo(() => {
    const mat = (c: string) =>
      new MeshBasicMaterial({ color: c, depthTest: false, depthWrite: false, toneMapped: false });
    const wheelsMat = mat(colors.steer);
    const goesMat = mat(colors.you);
    const make = (m: MeshBasicMaterial, head: boolean, order: number) => {
      const g = new Group();
      const s = new Mesh(bar, m);
      s.scale.x = head ? MARK_LEN - 0.5 : MARK_LEN;
      g.add(s);
      if (head) {
        const h = new Mesh(tip, m);
        h.position.x = MARK_LEN - 0.55;
        g.add(h);
      }
      g.traverse((o) => {
        o.renderOrder = order;
        o.frustumCulled = false;
      });
      g.position.y = 0.06;
      return g;
    };
    const wheels = make(wheelsMat, false, 29);
    const goes = make(goesMat, true, 28);
    const root = new Group();
    root.add(wheels, goes);
    root.visible = false;
    return { root, wheels, goes, mats: [wheelsMat, goesMat] };
  }, [colors]);
  useEffect(() => () => parts.mats.forEach((m) => m.dispose()), [parts]);

  useFrame(() => {
    const { p, view: st } = lane;
    const on = (drivePlayback.keyOn || !!useFreeze.getState().at) && !st.spun;
    parts.root.visible = on;
    if (!on) return;
    const c = Math.cos(st.yaw);
    const s = Math.sin(st.yaw);
    const x = st.x + c * p.a;
    const z = -(st.n + s * p.a);
    parts.wheels.position.set(x, 0.07, z);
    parts.goes.position.set(x, 0.06, z);
    // sim heading → world yaw about +Y is the same angle
    parts.wheels.rotation.set(0, st.yaw + shownSteer(st.steer - st.twist, SHOWN), 0);
    const moving = Math.hypot(st.vx, st.vy) > 1;
    parts.goes.visible = moving;
    parts.goes.rotation.set(0, st.yaw + (moving ? Math.atan2(st.vy + p.a * st.r, st.vx) : 0), 0);
  });

  return <primitive object={parts.root} />;
}
