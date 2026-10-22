/**
 * The drive camera, through the shared camera-controls.
 *
 * Chase: slides the orbit target along with the visitor's car and swings the azimuth to follow
 * its direction of TRAVEL (not its heading), so a car that slides shows up rotated on screen. A
 * focal offset puts the car in the middle of the part of the view no HUD panel covers (the same
 * idea as the explorer's framing), on a phone too. Orbiting by hand never fights it: while the
 * visitor drags, the camera is theirs, and the angle they leave it at becomes the new offset
 * from the travel direction.
 *
 * Top: looks straight down on the stretch of road where the manoeuvre happens, framed into the
 * free part of the view, so the lines of every car can be compared.
 *
 * Uses moveTo(…, false), setFocalOffset(…, false) and the azimuth setter per frame: with
 * transitions on, camera-controls queues a "rest" listener per call, which piles up.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, Fog, Spherical, Vector3 } from 'three';
import { fitBox } from '../../scene/CameraRig';
import { freeWindow } from '../freeWindow';
import { useScene, type Controls } from '../../scene/store';
import { betaOf, speedOf } from '../../sim/model';
import { offsetPoint, type Plan, type PathPoint } from '../../sim/scenarios';
import { angleDiff } from '../../spec/units';
import type { Lane } from './lanes';
import { groundScale } from './Tracks';
import type { CameraMode } from './state';
import { poseOrigin, type Ground } from './world';

/** start a little behind and to the right of the car (outside of a left-hand turn) */
const START_OFFSET = 0.75;
const TARGET_Y = 0.6;
/** how far ahead of the car to aim (s of travel) */
const LEAD = 0.1;
/** far clipping plane in drive mode (m) */
const DRIVE_FAR = 1200;
/** car lengths per unit of free-window height (NDC) at the chase distance */
const CHASE_SIZE = 2.4;
/** looking straight down (rad from vertical; exactly 0 has no defined screen "up") */
const TOP_POLAR = 0.02;

const sph = new Spherical();
const pt: Ground = { x: 0, z: 0 };
const pp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };

/** Where to stand to see `plan`'s overview stretch from straight above, inside `win`. */
function topShot(
  plan: Plan,
  win: readonly [number, number, number, number],
  fov: number,
  aspect: number,
) {
  const pts: Vector3[] = [];
  const [s0, s1] = plan.overview;
  const half = plan.roadWidth / 2 + 3;
  for (let s = s0; s <= s1; s += 2)
    for (const side of [-1, 1]) {
      const [x, n] = offsetPoint(plan.path, s, side * half, pp);
      pts.push(new Vector3(x, 0, -n));
    }
  const box = new Box3().setFromPoints(pts);
  // lay the stretch along the window's long side, travelling left→right (or bottom→top)
  const a = pts[0];
  const b = pts[pts.length - 1];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const size = box.getSize(new Vector3());
  const along = size.x >= size.z ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
  const portrait = (win[2] - win[0]) * aspect < win[3] - win[1];
  // screen right is (cos θ, −sin θ) on the ground; screen up is (−sin θ, −cos θ)
  const az = portrait ? Math.atan2(-along[0], -along[1]) : Math.atan2(-along[1], along[0]);
  const { target, dist } = fitBox(
    box,
    az,
    TOP_POLAR,
    fov,
    aspect,
    { padding: 0.06, window: win },
    pts,
  );
  return { target, dist, az };
}

export function useDriveCamera(lane: Lane, plan: Plan, mode: CameraMode, epoch: { n: number }) {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  // the stage's fog (and its distances before drive mode changed them)
  const fogged = useRef<{ fog: Fog; near: number; far: number } | null>(null);

  // the overhead view stands a few hundred metres up: see that far while driving, and give the
  // stage's fog back its own distances afterwards
  useEffect(() => {
    const saved = camera.far;
    camera.far = Math.max(saved, DRIVE_FAR);
    camera.updateProjectionMatrix();
    return () => {
      camera.far = saved;
      camera.updateProjectionMatrix();
      const f = fogged.current;
      if (f) {
        f.fog.near = f.near;
        f.fog.far = f.far;
      }
    };
  }, [camera]);

  const s = useRef({
    course: 0,
    raw: 0,
    offset: START_OFFSET,
    dragging: false,
    releasedAt: -1,
    seen: -1,
    ready: false,
    tx: 0,
    tz: 0,
    fx: 0,
    fy: 0,
    win: [-1, -1, 1, 1] as [number, number, number, number],
    winAt: -1,
    /** the visitor's zoom relative to the chase distance */
    zoom: 1,
    /** the chase distance and height to return to from the top view */
    chase: null as { dist: number; polar: number } | null,
    framed: '',
  });

  // listen for the visitor taking the camera (the controls may mount after us)
  const hooks = useRef<{ c: Controls | null; start: () => void; end: () => void }>(null);
  useEffect(
    () => () => {
      const h = hooks.current;
      h?.c?.removeEventListener('controlstart', h.start);
      h?.c?.removeEventListener('controlend', h.end);
      // hand the explorer back a centred view
      void h?.c?.setFocalOffset(0, 0, 0, true);
    },
    [],
  );

  useFrame(({ clock, camera }, dt) => {
    const c = useScene.getState().controls;
    const st = s.current;
    if (!c) return;
    if (!hooks.current || hooks.current.c !== c) {
      const old = hooks.current;
      old?.c?.removeEventListener('controlstart', old.start);
      old?.c?.removeEventListener('controlend', old.end);
      const h = {
        c,
        start: () => {
          st.dragging = true;
        },
        end: () => {
          st.dragging = false;
          st.releasedAt = clock.elapsedTime;
        },
      };
      c.addEventListener('controlstart', h.start);
      c.addEventListener('controlend', h.end);
      hooks.current = h;
    }
    const cam = camera as { fov?: number; aspect?: number };
    const fov = cam.fov ?? 35;
    const aspect = cam.aspect ?? 1.6;
    groundScale.mPerPx =
      (2 * c.distance * Math.tan((fov * Math.PI) / 360)) / Math.max(1, canvas.clientHeight);

    // the fog starts past the stretch being watched: the road ahead in the chase, nothing at all
    // from above (a new fog object comes with a theme change)
    const fog = scene.fog;
    if (fog instanceof Fog) {
      if (fogged.current?.fog !== fog) fogged.current = { fog, near: fog.near, far: fog.far };
      const d = c.distance;
      const near = mode === 'top' ? d * 2 : Math.max(fogged.current.near, d * 1.6);
      const far = mode === 'top' ? d * 4 : Math.max(fogged.current.far, d * 5);
      fog.near += (near - fog.near) * Math.min(1, dt * 4);
      fog.far += (far - fog.far) * Math.min(1, dt * 4);
    }

    // what the HUD leaves free, a couple of times a second (panels change size with content)
    const now = clock.elapsedTime;
    if (now - st.winAt > 0.5) {
      st.winAt = now;
      st.win = freeWindow(canvas, 1.4, 0.25) ?? [-1, -1, 1, 1];
    }

    if (mode === 'top') {
      const key = `${plan.id}|${plan.kmh}|${st.win.map((v) => v.toFixed(2))}|${aspect.toFixed(2)}`;
      if (st.framed !== key) {
        if (!st.framed.startsWith('top') && !st.chase)
          st.chase = { dist: c.distance, polar: c.polarAngle };
        st.framed = `top${key}`;
        const { target, dist, az } = topShot(plan, st.win, fov, aspect);
        void c.setFocalOffset(0, 0, 0, true);
        st.fx = st.fy = 0;
        void c.setLookAt(
          target.x + dist * Math.sin(TOP_POLAR) * Math.sin(az),
          target.y + dist * Math.cos(TOP_POLAR),
          target.z + dist * Math.sin(TOP_POLAR) * Math.cos(az),
          target.x,
          target.y,
          target.z,
          true,
        );
      }
      return;
    }

    // ── chase ──
    if (st.framed.startsWith('top')) {
      // back from the top view: the chase distance and height it had
      st.framed = '';
      st.ready = false;
      if (st.chase) {
        void c.dollyTo(st.chase.dist, true);
        void c.rotatePolarTo(st.chase.polar, true);
        st.chase = null;
      }
    }
    const car = lane.view;
    poseOrigin(lane.p, car, pt);
    const v = speedOf(car);
    // travel direction, unwrapped so the azimuth never jumps a full turn. The slip angle is
    // noise near standstill, so blend from the heading at a crawl to the travel direction
    const w = Math.min(1, Math.max(0, (v - 2) / 6));
    const travel = car.yaw + betaOf(car) * w;
    st.raw += angleDiff(travel, st.raw, 2 * Math.PI);
    if (st.seen !== epoch.n || !st.ready) {
      st.seen = epoch.n;
      st.ready = true;
      st.course = st.raw = car.yaw;
      st.tx = pt.x;
      st.tz = pt.z;
    }
    const k = 1 - Math.exp(-dt / 0.6);
    st.course += (st.raw - st.course) * k;

    // target: critically damped follow with a little lead along the velocity
    const vx = (Math.cos(car.yaw) * car.vx - Math.sin(car.yaw) * car.vy) * LEAD;
    const vz = -(Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy) * LEAD;
    const kt = 1 - Math.exp(-dt / 0.15);
    st.tx += (pt.x + vx - st.tx) * kt;
    st.tz += (pt.z + vz - st.tz) * kt;
    void c.moveTo(st.tx, TARGET_Y, st.tz, false);

    // the car in the middle of the free part of the view
    const [x0, y0, x1, y1] = st.win;
    const d = c.distance;
    const tanV = Math.tan((fov * Math.PI) / 360);
    const fx = -((x0 + x1) / 2) * d * tanV * aspect;
    const fy = ((y0 + y1) / 2) * d * tanV;
    const kf = 1 - Math.exp(-dt / 0.35);
    st.fx += (fx - st.fx) * kf;
    st.fy += (fy - st.fy) * kf;
    void c.setFocalOffset(st.fx, st.fy, 0, false);

    // a chase distance that leaves room round the car for the other cars and the lines ahead
    // (scaled by however far the visitor has zoomed it since)
    const fit = (lane.p.dims.length * CHASE_SIZE) / ((y1 - y0) * tanV);
    const handsOn = st.dragging || clock.elapsedTime - st.releasedAt < 0.6;
    if (handsOn) st.zoom = Math.max(0.2, Math.min(5, d / fit));
    else if (Math.abs(d - fit * st.zoom) > 0.01)
      void c.dollyTo(d + (fit * st.zoom - d) * (1 - Math.exp(-dt / 0.5)), false);

    // camera-controls azimuth θ puts the camera at (sin θ, ·, cos θ) from the target;
    // straight behind a car travelling at angle χ is θ = χ − π/2
    const behind = st.course - Math.PI / 2;
    if (handsOn) {
      c.getSpherical(sph, true);
      st.offset = sph.theta - behind;
    } else {
      c.azimuthAngle = behind + st.offset;
    }
  }, -2);
}
