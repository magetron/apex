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
 * Two cars run side by side: the chase aims partway across to the comparison car's lane and
 * stands back far enough for both. Round the key moment (and while the run is stopped there)
 * it frames the two cars themselves, wherever they have got to, from a little higher up.
 *
 * Top (and the replay at the end of a run): looks straight down, north-up (the key stretch
 * running up the screen, the same way round as the end-of-run picture), following both cars
 * and fitting them into the free part of the view; round the key moment it holds still over
 * the whole stretch both cars drive through it, so their lines can be compared as they part.
 *
 * Uses moveTo(…, false), setFocalOffset(…, false) and the azimuth setter per frame: with
 * transitions on, camera-controls queues a "rest" listener per call, which piles up. It runs after
 * the scene has posed the cars for this frame and before camera-controls moves the camera
 * (motion.ts: the frame order), and follows them the same way behind at any frame rate.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Fog, Spherical, Vector3 } from 'three';
import { fitBox } from '../../scene/CameraRig';
import { freeWindow } from '../freeWindow';
import { useScene, type Controls } from '../../scene/store';
import { betaOf, createState, speedOf, type CarState } from '../../sim/model';
import { offsetPoint, type Plan, type PathPoint } from '../../sim/scenarios';
import { angleDiff } from '../../spec/units';
import { useFreeze, type FreezeCar } from './freeze';
import type { KeyMoment } from './key';
import type { Lane } from './lanes';
import { CAMERA_PRIORITY, follow, frameDt } from './motion';
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
/** the chase aims this share of the way across to the comparison car's lane */
const ACROSS = 0.4;
/** and widens its view by this share of the lanes' spacing */
const WIDEN = 0.7;
/** round the key moment: from this high (rad from vertical, at most), with this much room */
const PAIR_POLAR = 0.8;
const PAIR_ROOM = 1.25;
/** …from a little before the slowed stretch to the end of what it led to (KeyMoment.end) */
const PAIR_LEAD = 0.4;
/** a stop's nose dive shows from the side, not from behind: round the key moment the chase
 *  swings this far off the car's tail (rad), to the side away from the other lane, and looks
 *  from this height (rad from vertical), the other car seen over the visitor's */
const DIVE_SWING = 1.45;
const DIVE_POLAR = 1.05;
/** at the pause the chase closes in on the tyres that decide it (the end that let go, or that
 *  is using more of its grip; catching a slide, the front): aimed at both cars' key axles, both
 *  whole cars framed with this much ground round them (m), from this high (rad from vertical),
 *  eased in and out over this long (s) */
const KEY_ROOM = 1.6;
const KEY_POLAR = 0.98;
const KEY_EASE = 0.45;
/** the view from above takes in both cars from a little before the key moment to a little
 *  after its last stop (s of sim), sampled this often */
const TOP_KEY_LEAD = 0.5;
const TOP_KEY_TAIL = 0.6;
const TOP_KEY_STEP = 0.1;
/** from above: the follow aims this far ahead along the cars' way (s of travel) */
const FOLLOW_LEAD = 0.15;
/** how far a car goes in FOLLOW_LEAD, world x and z (its velocity turned to the world) */
const aheadX = (c: CarState) => (Math.cos(c.yaw) * c.vx - Math.sin(c.yaw) * c.vy) * FOLLOW_LEAD;
const aheadZ = (c: CarState) => -(Math.sin(c.yaw) * c.vx + Math.cos(c.yaw) * c.vy) * FOLLOW_LEAD;
/** the replay from above follows both cars with this much ground round them (m) */
const REPLAY_ROOM = 4;
/** how far out the drive camera may stand (m): the two cars framed however far apart they end
 *  up (the explorer's own limit is for looking at one car) */
const DRIVE_MAX_DISTANCE = 400;
/** the still view from above leaves this much more room than the stretch needs */
const STILL_PAD = 1.06;

/**
 * North-up: the azimuth that runs a plan's key stretch (its overview, start to end) up the
 * screen when looking straight down. camera-controls puts the camera at (sin θ, ·, cos θ) from
 * the target, so screen up on the ground is (−sin θ, −cos θ) in world x, z.
 */
export function northUp(plan: Plan): number {
  const [s0, s1] = plan.overview;
  const a = plan.path.at(s0, pp);
  const ax = a.x;
  const an = a.n;
  const b = plan.path.at(s1, pp);
  const phi = Math.atan2(b.n - an, b.x - ax);
  // world z = −n: the ground direction (cos φ, −sin φ) must be screen up
  return Math.atan2(-Math.cos(phi), Math.sin(phi));
}

/** The part of the view the HUD leaves free (NDC [x0, y0, x1, y1]), as the camera last measured
 *  it: the cars' tags keep inside it. */
export const driveWindow = {
  win: [-1, -1, 1, 1] as [number, number, number, number],
  /** the breadcrumb at the top left (px from the canvas's top left): the tags keep off it */
  crumb: { x1: 0, y1: 0 },
  /** the free part in the page's own pixels (client coordinates), for overlays such as the
   *  end-of-run picture; zero width until measured */
  rect: { x: 0, y: 0, w: 0, h: 0 },
};

const sph = new Spherical();
/** a number to two decimals, as an integer: framing inputs this close count as the same */
const cents = (v: number) => Math.round(v * 100);
const ks = createState();
const pt: Ground = { x: 0, z: 0 };
const pr: Ground = { x: 0, z: 0 };
const pm: Ground = { x: 0, z: 0 };
const pp: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
const ka: Ground = { x: 0, z: 0 };
const kb: Ground = { x: 0, z: 0 };

/** The end of the cars that decides a stop: catching a slide, the front (where the hands act);
 *  else the one that let go (car A's first), else the one using more of its grip. Both cars are
 *  looked at there, so their rings compare. */
function keyEnd(cars: readonly FreezeCar[]): 'front' | 'rear' {
  if (cars[0]?.id === 'catch') return 'front';
  const out = cars.find((c) => c.out)?.out;
  if (out) return out;
  return Math.max(...cars.map((c) => c.useR)) >= Math.max(...cars.map((c) => c.useF))
    ? 'rear'
    : 'front';
}

/** Where a car's axle at `end` is on the ground (world x, z). */
function axleAt(lane: Lane, end: 'front' | 'rear', out: Ground): Ground {
  const st = lane.view;
  const ax = end === 'rear' ? lane.p.rear.x : lane.p.front.x;
  out.x = st.x + Math.cos(st.yaw) * ax;
  out.z = -(st.n + Math.sin(st.yaw) * ax);
  return out;
}

/** Where to stand to see `plan`'s overview stretch from straight above, inside `win`. */
function topShot(
  plan: Plan,
  win: readonly [number, number, number, number],
  fov: number,
  aspect: number,
  /** the comparison car's lane (m to the side): both lanes in the frame */
  offset: number,
  /** more ground points to take in (world x, z pairs): where the cars are at the key moment */
  extra: readonly number[] = [],
) {
  const pts: Vector3[] = [];
  const [s0, s1] = plan.overview;
  const half = plan.roadWidth / 2 + 3;
  for (let s = s0; s <= s1; s += 2)
    for (const lat of [Math.min(0, offset) - half, Math.max(0, offset) + half]) {
      const [x, n] = offsetPoint(plan.path, s, lat, pp);
      pts.push(new Vector3(x, 0, -n));
    }
  // the stretch's own ends say which way it runs across the screen; the key moment widens it
  const a = pts[0];
  const b = pts[pts.length - 1];
  for (let i = 0; i + 1 < extra.length; i += 2) pts.push(new Vector3(extra[i], 0, extra[i + 1]));
  const box = new Box3().setFromPoints(pts);
  // lay the stretch along the window's long side, travelling left→right (or bottom→top)
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

/** Where both cars are on the ground round the key moment (world x, z pairs), for the view from
 *  above to take in. */
function keyGround(
  main: Lane,
  rival: Lane,
  key: KeyMoment | null,
  /** to the end of what the moment led to (its `end`), not just its last stop */
  through = false,
): number[] {
  if (!key) return [];
  const out: number[] = [];
  const end = through
    ? key.end
    : (key.freeze.length ? key.freeze[key.freeze.length - 1] : key.t1) + TOP_KEY_TAIL;
  const from = Math.max(0, key.t0 - TOP_KEY_LEAD);
  for (const l of [main, rival])
    for (let t = from; t <= Math.min(end, l.head); t += TOP_KEY_STEP) {
      // where the car is drawn (on its lane, behind the other on the same line)
      l.drawAt(t, ks);
      poseOrigin(l.p, ks, pr);
      out.push(pr.x, pr.z);
    }
  return out;
}

export function useDriveCamera(
  lane: Lane,
  plan: Plan,
  mode: CameraMode,
  epoch: { n: number },
  /** the comparison car's lane, m to the side of the visitor's (+ = left) */
  offset = 0,
  /** both cars round the key moment: the comparison's lane, the moment, the playhead; and the
   *  replay from straight above at the end of a run (its stretch: both cars over it framed) */
  pair?: {
    rival: Lane;
    focus: { key: KeyMoment | null };
    t: { now: number };
    replay?: { on: boolean; t0: number; t1: number };
  },
) {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const straight = useMemo(() => plan.road.ks.every((k) => k === 0), [plan]);
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
    /** what the follow aimed at last frame (NaN: start afresh) */
    px: NaN,
    pz: NaN,
    fx: 0,
    fy: 0,
    win: [-1, -1, 1, 1] as [number, number, number, number],
    winAt: -1,
    /** the visitor's zoom relative to the chase distance */
    zoom: 1,
    /** the chase distance and height to return to from the top view */
    chase: null as { dist: number; polar: number } | null,
    /** 'top' while the view from above is framed, and what it was framed for */
    framed: '',
    /** the replay's fixed heading from above */
    replayAz: 0,
    /** from above round the key moment: the still view over the whole stretch, and what it was
     *  worked out for */
    still: {
      key: null as KeyMoment | null,
      offset: NaN,
      aspect: 0,
      win: [0, 0, 0, 0],
      tx: 0,
      tz: 0,
      dist: 0,
    },
    /** 0..1: how far the view from above has gone over to holding still */
    hold: 0,
    /** the explorer's own distance limit, given back when drive mode ends */
    maxDistance: NaN,
    top: {
      plan: null as Plan | null,
      offset: 0,
      key: null as KeyMoment | null,
      aspect: 0,
      win: [0, 0, 0, 0],
    },
    /** 0..1: how far the chase has gone over to framing both cars */
    pair: 0,
    /** the visitor's own camera height, to go back to after the key moment */
    polar: NaN,
    /** 0..1: how far the chase has closed in on the key tyres (at the pause), and on what: the
     *  point between them and the distance that frames them (kept while it eases back out) */
    key: 0,
    kx: 0,
    kz: 0,
    kFit: 0,
  });

  // listen for the visitor taking the camera (the controls may mount after us)
  const hooks = useRef<{ c: Controls | null; start: () => void; end: () => void }>(null);
  useEffect(
    () => () => {
      const h = hooks.current;
      h?.c?.removeEventListener('controlstart', h.start);
      h?.c?.removeEventListener('controlend', h.end);
      // hand the explorer back a centred view, and its own distance limit
      void h?.c?.setFocalOffset(0, 0, 0, true);
      if (h?.c && Number.isFinite(s.current.maxDistance)) h.c.maxDistance = s.current.maxDistance;
    },
    [],
  );

  useFrame(({ clock, camera }, delta) => {
    const c = useScene.getState().controls;
    const st = s.current;
    if (!c) return;
    const dt = frameDt(delta);
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
      if (!Number.isFinite(st.maxDistance)) st.maxDistance = c.maxDistance;
    }
    // room to stand back: both cars framed, however far apart they end up (kept: the explorer's
    // camera rig may hand its own limit back on a render)
    if (c.maxDistance < DRIVE_MAX_DISTANCE) c.maxDistance = DRIVE_MAX_DISTANCE;
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
      driveWindow.win = st.win;
      const crumb = document.querySelector('.apx-dock--top-left')?.getBoundingClientRect();
      const cv = canvas.getBoundingClientRect();
      driveWindow.crumb.x1 = crumb ? crumb.right - cv.left : 0;
      driveWindow.crumb.y1 = crumb ? crumb.bottom - cv.top : 0;
      const [wx0, wy0, wx1, wy1] = st.win;
      const r = driveWindow.rect;
      r.x = cv.left + ((wx0 + 1) / 2) * cv.width;
      r.y = cv.top + ((1 - wy1) / 2) * cv.height;
      r.w = ((wx1 - wx0) / 2) * cv.width;
      r.h = ((wy1 - wy0) / 2) * cv.height;
    }

    const replaying = !!pair?.replay?.on;
    // from above (the view, and the replay at the end of a run): straight down and north-up,
    // the key stretch running up the screen, held there whatever happens (a drag aside). It
    // follows both cars, close enough to see one run wide of (or tighter than) its planned
    // line; round the key moment it holds still over the whole stretch they drive through it
    if ((replaying || mode === 'top') && pair) {
      if (st.framed !== 'replay') {
        if (st.framed !== 'top' && !st.chase) st.chase = { dist: c.distance, polar: c.polarAngle };
        st.framed = 'replay';
        st.replayAz = northUp(plan);
        st.ready = false;
        st.hold = 0;
      }
      const az = st.replayAz;
      if (!st.dragging) {
        // eased round to it, then kept there (a frame's nudge from anything else undone)
        const kr = 1 - Math.exp(-dt / 0.2);
        c.azimuthAngle += angleDiff(az, c.azimuthAngle, 2 * Math.PI) * kr;
        c.polarAngle += (TOP_POLAR - c.polarAngle) * kr;
      }
      const [x0, y0, x1, y1] = st.win;
      const tanV = Math.tan((fov * Math.PI) / 360);
      // the still view over the key moment's whole stretch (both cars, from a little before it
      // to the end of what it led to), worked out again only when what it frames changes
      const key = pair.focus.key;
      const sv = st.still;
      if (
        key &&
        (sv.key !== key ||
          sv.offset !== offset ||
          sv.aspect !== cents(aspect) ||
          sv.win[0] !== cents(x0) ||
          sv.win[1] !== cents(y0) ||
          sv.win[2] !== cents(x1) ||
          sv.win[3] !== cents(y1))
      ) {
        sv.key = key;
        sv.offset = offset;
        sv.aspect = cents(aspect);
        sv.win[0] = cents(x0);
        sv.win[1] = cents(y0);
        sv.win[2] = cents(x1);
        sv.win[3] = cents(y1);
        // straight down, the ground is seen evenly: the stretch's extent across the screen and
        // up it, round both cars' paths with a car length to spare, sets the distance; its
        // middle is the target (the focal offset below puts that in the free part's middle)
        const g = keyGround(lane, pair.rival, key);
        const ca = Math.cos(az);
        const sa = Math.sin(az);
        let a0 = Infinity;
        let a1 = -Infinity;
        let u0 = Infinity;
        let u1 = -Infinity;
        for (let i = 0; i + 1 < g.length; i += 2) {
          const ac = g[i] * ca - g[i + 1] * sa;
          const up = g[i] * sa + g[i + 1] * ca;
          a0 = Math.min(a0, ac);
          a1 = Math.max(a1, ac);
          u0 = Math.min(u0, up);
          u1 = Math.max(u1, up);
        }
        if (g.length) {
          const room = lane.p.dims.length;
          const am = (a0 + a1) / 2;
          const um = (u0 + u1) / 2;
          sv.tx = am * ca + um * sa;
          sv.tz = -am * sa + um * ca;
          sv.dist =
            STILL_PAD *
            Math.max(
              ((a1 - a0) / 2 + room) / (((x1 - x0) / 2) * tanV * aspect),
              ((u1 - u0) / 2 + room) / (((y1 - y0) / 2) * tanV),
            );
        }
      }
      // still over the stretch the key moment covers (to a little past its last stop), in the
      // view from above; the replay at the end follows the two cars close up instead, so they
      // are cars, not dots
      const t = pair.t.now;
      const lastStop = key ? (key.freeze.length ? key.freeze[key.freeze.length - 1] : key.t1) : 0;
      const still =
        !!key &&
        !replaying &&
        sv.key === key &&
        sv.dist > 0 &&
        (!!useFreeze.getState().at || (t >= key.t0 - PAIR_LEAD && t <= lastStop + TOP_KEY_TAIL));
      st.hold += ((still ? 1 : 0) - st.hold) * (1 - Math.exp(-dt / 0.35));
      poseOrigin(lane.p, lane.view, pm);
      poseOrigin(pair.rival.p, pair.rival.view, pr);
      // between the two, a moment ahead along the way they go (the follow lags otherwise)
      const a = lane.view;
      const b = pair.rival.view;
      let mx = (pm.x + pr.x) / 2 + (aheadX(a) + aheadX(b)) / 2;
      let mz = (pm.z + pr.z) / 2 + (aheadZ(a) + aheadZ(b)) / 2;
      const dx = pr.x - pm.x;
      const dz = pr.z - pm.z;
      // apart across the view and up it, from straight above
      const across = Math.abs(dx * Math.cos(az) - dz * Math.sin(az));
      const up = Math.abs(dx * Math.sin(az) + dz * Math.cos(az));
      const room = REPLAY_ROOM + lane.p.dims.length / 2;
      let want = Math.max(
        (across / 2 + room) / (((x1 - x0) / 2) * tanV * aspect),
        (up / 2 + room) / (((y1 - y0) / 2) * tanV),
      );
      if (st.hold > 1e-3) {
        const w = st.hold;
        mx += (sv.tx - mx) * w;
        mz += (sv.tz - mz) * w;
        want += (sv.dist - want) * w;
      }
      if (!st.ready) {
        st.ready = true;
        st.tx = mx;
        st.tz = mz;
        st.px = st.pz = NaN;
      }
      st.tx = follow(st.tx, Number.isNaN(st.px) ? mx : st.px, mx, dt, 0.15);
      st.tz = follow(st.tz, Number.isNaN(st.pz) ? mz : st.pz, mz, dt, 0.15);
      st.px = mx;
      st.pz = mz;
      void c.moveTo(st.tx, 0, st.tz, false);
      const d = c.distance;
      void c.dollyTo(d + (want - d) * (1 - Math.exp(-dt / 0.5)), false);
      // the pair in the middle of the free part of the view
      const fx = -((x0 + x1) / 2) * d * tanV * aspect;
      const fy = ((y0 + y1) / 2) * d * tanV;
      const kf = 1 - Math.exp(-dt / 0.35);
      st.fx += (fx - st.fx) * kf;
      st.fy += (fy - st.fy) * kf;
      void c.setFocalOffset(st.fx, st.fy, 0, false);
      return;
    }
    if (mode === 'top') {
      const km = pair?.focus.key ?? null;
      // framed again only when what it frames changes (compared field by field: nothing is
      // built per frame)
      const tf = st.top;
      const win = st.win;
      const same =
        st.framed === 'top' &&
        tf.plan === plan &&
        tf.offset === offset &&
        tf.key === km &&
        tf.aspect === cents(aspect) &&
        tf.win[0] === cents(win[0]) &&
        tf.win[1] === cents(win[1]) &&
        tf.win[2] === cents(win[2]) &&
        tf.win[3] === cents(win[3]);
      if (!same) {
        if (st.framed !== 'top' && !st.chase) st.chase = { dist: c.distance, polar: c.polarAngle };
        st.framed = 'top';
        tf.plan = plan;
        tf.offset = offset;
        tf.key = km;
        tf.aspect = cents(aspect);
        for (let i = 0; i < 4; i++) tf.win[i] = cents(win[i]);
        const { target, dist, az } = topShot(
          plan,
          st.win,
          fov,
          aspect,
          offset,
          pair ? keyGround(lane, pair.rival, km) : undefined,
        );
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
    if (st.framed === 'top' || st.framed === 'replay') {
      // back from the top view (or the replay): the chase distance and height it had
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
    pm.x = pt.x;
    pm.z = pt.z;
    // partway across to the comparison car's lane, along the road's normal where the car is
    if (offset) {
      const road = plan.road;
      const at = road.at(straight ? 0 : lane.rec.sAtTime(car.t) % road.length, pp);
      pt.x -= Math.sin(at.h) * offset * ACROSS;
      pt.z -= Math.cos(at.h) * offset * ACROSS;
    }
    // both cars, always: aim between them and stand back for both (car B is never lost behind a
    // panel or off-screen, after a spin least of all); from the key moment to the end of the run,
    // from a little higher up too (a stop: from the side)
    let apart = 0;
    let dxR = 0;
    let dxF = 0;
    if (pair) {
      const key = pair.focus.key;
      const on = !!useFreeze.getState().at || (!!key && pair.t.now >= key.t0 - PAIR_LEAD);
      st.pair += ((on ? 1 : 0) - st.pair) * (1 - Math.exp(-dt / 0.45));
      poseOrigin(pair.rival.p, pair.rival.view, pr);
      apart = Math.hypot(pr.x - pm.x, pr.z - pm.z);
      // how far apart across the view and along it (the camera's own right and forward)
      const az = c.azimuthAngle;
      dxR = Math.abs((pr.x - pm.x) * Math.cos(az) - (pr.z - pm.z) * Math.sin(az));
      dxF = Math.abs((pr.x - pm.x) * Math.sin(az) + (pr.z - pm.z) * Math.cos(az));
      pt.x = (pm.x + pr.x) / 2;
      pt.z = (pm.z + pr.z) / 2;
    }
    const v = speedOf(car);
    // travel direction, unwrapped so the azimuth never jumps a full turn. The slip angle is
    // noise near standstill, so blend from the heading at a crawl to the travel direction
    const w = Math.min(1, Math.max(0, (v - 2) / 6));
    const travel = car.yaw + betaOf(car) * w;
    let rawWas = st.raw;
    st.raw += angleDiff(travel, st.raw, 2 * Math.PI);
    if (st.seen !== epoch.n || !st.ready) {
      st.seen = epoch.n;
      st.ready = true;
      st.course = st.raw = rawWas = car.yaw;
      st.tx = pt.x;
      st.tz = pt.z;
      st.px = st.pz = NaN;
    }
    // swung round after the travel direction, the same way behind it through a turn whatever
    // the frame rate
    st.course = follow(st.course, rawWas, st.raw, dt, 0.6);

    // at the pause: in close on the tyres that decide it, both cars' key axles (a stop is the
    // load on both axles, seen from the side: it stays on the whole cars)
    const frame = useFreeze.getState().at;
    const frozen = !!pair && !!frame && plan.id !== 'braking';
    st.key += ((frozen ? 1 : 0) - st.key) * (1 - Math.exp(-dt / KEY_EASE));
    if (frozen) {
      const end = keyEnd(frame.cars);
      axleAt(lane, end, ka);
      axleAt(pair.rival, end, kb);
      st.kx = (ka.x + kb.x) / 2;
      st.kz = (ka.z + kb.z) / 2;
    }
    if (st.key > 1e-3) {
      pt.x += (st.kx - pt.x) * st.key;
      pt.z += (st.kz - pt.z) * st.key;
    }

    // target: critically damped follow with a little lead along the velocity (none at the
    // pause, where nothing moves)
    const lead = LEAD * (1 - st.key);
    const vx = (Math.cos(car.yaw) * car.vx - Math.sin(car.yaw) * car.vy) * lead;
    const vz = -(Math.sin(car.yaw) * car.vx + Math.cos(car.yaw) * car.vy) * lead;
    const ax = pt.x + vx;
    const az = pt.z + vz;
    st.tx = follow(st.tx, Number.isNaN(st.px) ? ax : st.px, ax, dt, 0.15);
    st.tz = follow(st.tz, Number.isNaN(st.pz) ? az : st.pz, az, dt, 0.15);
    st.px = ax;
    st.pz = az;
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
    let fit = (lane.p.dims.length * CHASE_SIZE + WIDEN * Math.abs(offset)) / ((y1 - y0) * tanV);
    // a stop, seen from the side: the cars' lengths fill the view, the gap between them is
    // foreshortened (closer in, so the nose dive shows)
    const dive = plan.id === 'braking' && !!pair;
    if (pair) {
      const len = lane.p.dims.length;
      const span = dive ? 0.6 * apart + 1.3 * len : apart + 2 * len;
      let both = (span * PAIR_ROOM) / ((y1 - y0) * tanV);
      if (!dive) {
        // both cars inside the free part of the view: across it (its width) and along the road
        // (foreshortened up the view), with a car length to spare round each
        const across = ((dxR / 2 + len) * PAIR_ROOM) / (((x1 - x0) / 2) * tanV * aspect);
        const along =
          (((dxF / 2) * Math.cos(c.polarAngle) + len) * PAIR_ROOM) / (((y1 - y0) / 2) * tanV);
        both = Math.max(both, across, along);
      }
      fit += ((dive ? both : Math.max(fit, both)) - fit) * (dive ? st.pair : 1);
    }
    if (st.key > 1e-3) {
      if (frozen) {
        // round the key axles, but both whole cars (nose and tail) inside the free part of the
        // view with a little ground to spare: never under a panel
        const az = c.azimuthAngle;
        const ca = Math.cos(az);
        const sa = Math.sin(az);
        let across = 0;
        let along = 0;
        for (let i = 0; i < 4; i++) {
          const ln = i < 2 ? lane : pair.rival;
          const { length, overhangF } = ln.p.dims;
          poseOrigin(ln.p, ln.view, pr);
          const nose = ln.p.L / 2 + overhangF;
          const x = i % 2 === 0 ? nose : nose - length;
          const px = pr.x + Math.cos(ln.view.yaw) * x - st.kx;
          const pz = pr.z - Math.sin(ln.view.yaw) * x - st.kz;
          across = Math.max(across, Math.abs(px * ca - pz * sa));
          along = Math.max(along, Math.abs(px * sa + pz * ca));
        }
        st.kFit = Math.max(
          (across + KEY_ROOM) / (((x1 - x0) / 2) * tanV * aspect),
          (along * Math.cos(KEY_POLAR) + KEY_ROOM) / (((y1 - y0) / 2) * tanV),
        );
      }
      fit += (st.kFit - fit) * st.key;
    }
    const handsOn = st.dragging || clock.elapsedTime - st.releasedAt < 0.6;
    if (handsOn) st.zoom = Math.max(0.2, Math.min(5, d / fit));
    else if (Math.abs(d - fit * st.zoom) > 0.01)
      void c.dollyTo(d + (fit * st.zoom - d) * (1 - Math.exp(-dt / 0.5)), false);

    // camera-controls azimuth θ puts the camera at (sin θ, ·, cos θ) from the target;
    // straight behind a car travelling at angle χ is θ = χ − π/2 (its right side, θ = χ)
    const behind = st.course - Math.PI / 2;
    // a stop: from the side round the key moment, where the nose dive shows
    const swing = dive ? (offset > 0 ? DIVE_SWING : -DIVE_SWING) - st.offset : 0;
    if (handsOn) {
      c.getSpherical(sph, true);
      st.offset = sph.theta - behind - swing * st.pair;
    } else {
      c.azimuthAngle = behind + st.offset + swing * st.pair;
    }
    // and from a little higher round the key moment (lower for a stop), back to the visitor's
    // own height after
    if (st.pair < 1e-3 || handsOn || !Number.isFinite(st.polar)) st.polar = c.polarAngle;
    else {
      const to = dive ? DIVE_POLAR : Math.min(st.polar, PAIR_POLAR);
      const pairPolar = st.polar + (to - st.polar) * st.pair;
      // (lower at the pause, so the rings under the tyres show beside them)
      c.polarAngle = pairPolar + (KEY_POLAR - pairPolar) * st.key;
    }
  }, CAMERA_PRIORITY);
}
