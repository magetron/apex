/**
 * The cause and the moment, drawn on the cars themselves.
 *  - LoadBars: at each axle a bar standing on the road, as tall as the load on that axle right
 *    now (a tick marks its load standing still), filled as far as that axle's grip is in use,
 *    in the slip wedges' colours: quiet, amber at the limit, red sliding. Brake and the front
 *    bar grows while the rear one shrinks and its fill climbs to the top: the light rear runs
 *    out of grip and the car rotates. The bars face the camera, so they read from the chase
 *    view and from above alike, and are drawn through the body (x-ray).
 *  - WatchRing: a pulsing ring round the axle to watch (lane.watch) around the key moment.
 * Preallocated; nothing is allocated per frame.
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  type Material,
} from 'three';
import { axleUse, FL, G, RL } from '../../sim/model';
import type { DriveColors } from './colors';
import type { Lane } from './lanes';
import { gripColor } from './Tracks';

/** bar height per share of the car's weight on that axle (m): half the weight stands 1.4 m,
 *  about roof height */
export const LOAD_SCALE = 2.8;
const TICK_H = 0.05;
const ORDER = 24;

/** grows up from its base */
const bar = new PlaneGeometry(1, 1).translate(0, 0.5, 0);
const tick = new PlaneGeometry(1, 1);
const ring = new RingGeometry(0.88, 1, 64).rotateX(-Math.PI / 2);

function xray(color: string, opacity: number) {
  return new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest: false,
    depthWrite: false,
  });
}

function mesh(geo: PlaneGeometry | RingGeometry, mat: Material, order: number) {
  const m = new Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = order;
  return m;
}

export function LoadBars({
  lane,
  colors,
  color,
  main = false,
}: {
  lane: Lane;
  colors: DriveColors;
  /** the car's own colour, for a comparison car's bars (they often stand among the others) */
  color: string;
  /** the visitor's car: wider bars, drawn over the comparison cars' */
  main?: boolean;
}) {
  const width = main ? 0.42 : 0.16;
  const parts = useMemo(() => {
    // the bar's full height (the load) as a faint column, the fill (grip in use) solid
    const back = main ? xray(colors.you, 0.22) : xray(color, 0.28);
    const mark = xray(main ? colors.you : color, 0.9);
    const order = main ? ORDER + 4 : ORDER;
    const axles = [0, 1].map(() => {
      const fillMat = xray(colors.ring, main ? 0.95 : 0.7);
      const g = new Group();
      const b = mesh(bar, back, order);
      const f = mesh(bar, fillMat, order + 1);
      const t = mesh(tick, mark, order + 2);
      g.add(b, f, t);
      return { g, b, f, t, fillMat };
    });
    return { back, mark, axles };
  }, [colors, color, main]);
  useEffect(
    () => () => {
      parts.back.dispose();
      parts.mark.dispose();
      for (const a of parts.axles) a.fillMat.dispose();
    },
    [parts],
  );
  const palette = useMemo(
    () => ({
      grip: new Color(colors.ring),
      limit: new Color(colors.limit),
      slide: new Color(colors.slide),
    }),
    [colors],
  );

  useFrame(({ camera }) => {
    const { p, view: st } = lane;
    const w = p.m * G;
    const c = Math.cos(st.yaw);
    const s = Math.sin(st.yaw);
    for (let k = 0; k < 2; k++) {
      const a = parts.axles[k];
      const front = k === 0;
      const ax = front ? p.a : -p.b;
      a.g.position.set(st.x + c * ax, 0, -(st.n + s * ax));
      a.g.quaternion.copy(camera.quaternion);
      const load = front ? st.fz[0] + st.fz[1] : st.fz[2] + st.fz[3];
      const h = Math.max(0.01, (LOAD_SCALE * load) / w);
      const use = axleUse(st, front ? FL : RL);
      a.b.scale.set(width, h, 1);
      a.f.scale.set(width * 0.6, h * Math.min(1, Math.max(0.001, use)), 1);
      a.t.position.set(0, (LOAD_SCALE * (front ? p.b : p.a)) / p.L, 0);
      a.t.scale.set(width * 1.9, TICK_H, 1);
      gripColor(a.fillMat.color, use, palette);
    }
  });

  return (
    <group>
      {parts.axles.map((a, i) => (
        <primitive key={i} object={a.g} />
      ))}
    </group>
  );
}

/** Rings the axle lane.watch names, while the playhead is in its stretch. */
export function WatchRing({
  lane,
  t,
  color,
  size = 2.6,
}: {
  lane: Lane;
  t: { now: number };
  color: string;
  /** the slip wedge's length there (m): the ring takes in the wedge's root and the load bar */
  size?: number;
}) {
  const parts = useMemo(() => {
    const mat = xray(color, 0.9);
    return { mat, m: mesh(ring, mat, ORDER - 1) };
  }, [color]);
  useEffect(() => () => parts.mat.dispose(), [parts]);

  useFrame(({ clock }) => {
    const w = lane.watch;
    const on = !!w && t.now >= w.t0 && t.now <= w.t1;
    parts.m.visible = on;
    if (!on) return;
    const { p, view: st } = lane;
    const front = w.axle === 'front';
    // centred a little out along the wedge (ahead of the front axle, behind the rear one)
    const ax = front ? p.a + 0.3 * size : -p.b - 0.3 * size;
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 7);
    parts.m.position.set(st.x + Math.cos(st.yaw) * ax, 0.04, -(st.n + Math.sin(st.yaw) * ax));
    parts.m.scale.setScalar(0.62 * size * (1 + 0.07 * pulse));
    parts.mat.opacity = 0.5 + 0.45 * pulse;
  });

  return <primitive object={parts.m} />;
}
