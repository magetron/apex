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
 * Both cars, always: the chase aims between them and stands back far enough for both. Round the
 * key moment (and while the run is stopped there) it frames the two cars themselves, wherever
 * they have got to, from a little higher up. Where the driver's action is a pedal (the load it
 * moves between the axles is the point), it comes down and round to a low three-quarter view of
 * the cars' sides from just before the action to the end of what it led to, the stop included:
 * the body's pitch (state.ts shownPitch), the nose dipping or the tail squatting, reads against
 * the road and the wheels, which a view from behind and above hides. Then it eases back behind.
 *
 * The replay at the end of a run looks straight down, north-up (the key stretch running up the
 * screen, the same way round as the end-of-run picture), following both cars and fitting them
 * into the free part of the view.
 *
 * Uses moveTo(…, false), setFocalOffset(…, false) and the azimuth setter per frame: with
 * transitions on, camera-controls queues a "rest" listener per call, which piles up. It runs after
 * the scene has posed the cars for this frame and before camera-controls moves the camera
 * (motion.ts: the frame order), and follows them the same way behind at any frame rate.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Fog, Spherical } from 'three';
import { freeWindow } from '../freeWindow';
import { useScene, type Controls } from '../../scene/store';
import { betaOf, speedOf, type CarState } from '../../sim/model';
import type { Plan, PathPoint } from '../../sim/scenarios';
import { angleDiff } from '../../spec/units';
import { useFreeze, type FreezeCar } from './freeze';
import { movesLoad } from './glyphs';
import type { KeyMoment } from './key';
import type { Lane } from './lanes';
import { CAMERA_PRIORITY, ease, follow, frameDt } from './motion';
import { groundScale } from './Tracks';
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
/** round the key moment: from this high (rad from vertical, at most), with this much room,
 *  eased over this long (s) */
const PAIR_POLAR = 0.8;
const PAIR_ROOM = 1.25;
const PAIR_EASE = 0.45;
/** …from a little before the slowed stretch to the end of the run */
const PAIR_LEAD = 0.4;
/** where the driver's action moves load between the axles (glyphs.tsx movesLoad), the side
 *  view: this far off the cars' tails (rad; a full side is π/2), on the side the chase already
 *  looks from, from this low (rad from vertical), closer in: this many car lengths round each
 *  car's middle; swung round over about this long (s), from the slowed stretch to the end of
 *  what it led to (KeyMoment.end) */
const SIDE_SWING = 1.2;
const SIDE_POLAR = 1.25;
const SIDE_ROOM = 0.8;
const SIDE_EASE = 0.5;
/** at the pause the chase closes in on the tyres that decide it (the end that let go, or that
 *  is using more of its grip; catching a slide, the front): aimed at both cars' key axles, both
 *  whole cars framed with this much ground round them (m), from this high (rad from vertical;
 *  from the side, a little higher than the side view, so the rings and the marks on the road
 *  show beside the profiles), eased in and out over this long (s) */
const KEY_ROOM = 1.6;
const KEY_POLAR = 0.98;
const KEY_SIDE_POLAR = 1.12;
const KEY_EASE = 0.45;
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

/** 0..1 eased in and out (smoothstep): a swing that starts and settles gently */
const smooth = (w: number) => w * w * (3 - 2 * w);

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
};

/** How far the chase has come round to the cars' sides (0..1, as last framed): the level the
 *  bodies pitch against (Level.tsx) shows with it. */
export const driveSide = { w: 0 };

const sph = new Spherical();
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

export function useDriveCamera(
  lane: Lane,
  plan: Plan,
  epoch: { n: number },
  /** both cars round the key moment: the comparison's lane, the moment, the playhead; and the
   *  replay from straight above at the end of a run */
  pair?: {
    rival: Lane;
    focus: { key: KeyMoment | null };
    t: { now: number };
    replay?: { on: boolean };
  },
) {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  // the stage's fog (and its distances before drive mode changed them)
  const fogged = useRef<{ fog: Fog; near: number; far: number } | null>(null);

  // the replay from above stands a few hundred metres up: see that far while driving, and give
  // the stage's fog back its own distances afterwards
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
    /** the chase distance and height to return to from the replay */
    chase: null as { dist: number; polar: number } | null,
    /** 'replay' while the replay from above is framed */
    framed: '',
    /** the replay's fixed heading from above */
    replayAz: 0,
    /** the explorer's own distance limit, given back when drive mode ends */
    maxDistance: NaN,
    /** 0..1: how far the chase has gone over to framing both cars */
    pair: 0,
    /** the visitor's own camera height, to go back to after the key moment */
    polar: NaN,
    /** 0..1: how far the chase has swung round to the cars' sides, and to which (+1 right) */
    side: 0,
    sideSign: 1,
    /** the visitor took the camera round the key moment: its angle and height stay theirs for
     *  the rest of the run */
    mine: false,
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
      driveSide.w = 0;
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

    // the fog starts past the stretch being watched: the road ahead (a new fog object comes
    // with a theme change)
    const fog = scene.fog;
    if (fog instanceof Fog) {
      if (fogged.current?.fog !== fog) fogged.current = { fog, near: fog.near, far: fog.far };
      const d = c.distance;
      const kf = ease(dt, 0.25);
      fog.near += (Math.max(fogged.current.near, d * 1.6) - fog.near) * kf;
      fog.far += (Math.max(fogged.current.far, d * 5) - fog.far) * kf;
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
    }
    const [x0, y0, x1, y1] = st.win;
    const tanV = Math.tan((fov * Math.PI) / 360);

    // the replay at the end of a run: straight down and north-up, the key stretch running up
    // the screen, held there whatever happens (a drag aside), following both cars close enough
    // to see one run wide of (or tighter than) the other, so they are cars, not dots
    if (pair?.replay?.on) {
      driveSide.w = 0;
      if (st.framed !== 'replay') {
        if (!st.chase) st.chase = { dist: c.distance, polar: c.polarAngle };
        st.framed = 'replay';
        st.replayAz = northUp(plan);
        st.ready = false;
      }
      const az = st.replayAz;
      if (!st.dragging) {
        // eased round to it, then kept there (a frame's nudge from anything else undone)
        const kr = ease(dt, 0.2);
        c.azimuthAngle += angleDiff(az, c.azimuthAngle, 2 * Math.PI) * kr;
        c.polarAngle += (TOP_POLAR - c.polarAngle) * kr;
      }
      poseOrigin(lane.p, lane.view, pm);
      poseOrigin(pair.rival.p, pair.rival.view, pr);
      // between the two, a moment ahead along the way they go (the follow lags otherwise)
      const a = lane.view;
      const b = pair.rival.view;
      const mx = (pm.x + pr.x) / 2 + (aheadX(a) + aheadX(b)) / 2;
      const mz = (pm.z + pr.z) / 2 + (aheadZ(a) + aheadZ(b)) / 2;
      const dx = pr.x - pm.x;
      const dz = pr.z - pm.z;
      // apart across the view and up it, from straight above
      const across = Math.abs(dx * Math.cos(az) - dz * Math.sin(az));
      const up = Math.abs(dx * Math.sin(az) + dz * Math.cos(az));
      const room = REPLAY_ROOM + lane.p.dims.length / 2;
      const want = Math.max(
        (across / 2 + room) / (((x1 - x0) / 2) * tanV * aspect),
        (up / 2 + room) / (((y1 - y0) / 2) * tanV),
      );
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
      void c.dollyTo(d + (want - d) * ease(dt, 0.5), false);
      // the pair in the middle of the free part of the view
      const fx = -((x0 + x1) / 2) * d * tanV * aspect;
      const fy = ((y0 + y1) / 2) * d * tanV;
      const kf = ease(dt, 0.35);
      st.fx += (fx - st.fx) * kf;
      st.fy += (fy - st.fy) * kf;
      void c.setFocalOffset(st.fx, st.fy, 0, false);
      return;
    }

    // ── chase ──
    if (st.framed === 'replay') {
      // back from the replay: the chase distance and height it had
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
    // the pause: in close on the tyres that decide it, both cars' key axles (a stop is the load
    // on both axles, seen from the side: it stays on the whole cars)
    const frame = useFreeze.getState().at;
    const frozen = !!pair && !!frame && plan.id !== 'braking';
    // where the driver's action moves load between the axles, its key moment from the side (not
    // while the visitor drives: they steer from behind)
    const profile = !!pair && !lane.run.manual && movesLoad(plan.id);
    // both cars, always: aim between them and stand back for both (car B is never lost behind a
    // panel or off-screen, after a spin least of all); from the key moment to the end of the run,
    // from a little higher up too, or from the side
    let apart = 0;
    let dxR = 0;
    let dxF = 0;
    if (pair) {
      const key = pair.focus.key;
      const t = pair.t.now;
      const on = !!frame || (!!key && t >= key.t0 - PAIR_LEAD);
      st.pair += ((on ? 1 : 0) - st.pair) * ease(dt, PAIR_EASE);
      const side = profile && (!!frame || (!!key && t >= key.t0 - PAIR_LEAD && t <= key.end));
      // the side it swings to: the one the chase already looks from, kept for the whole swing
      if (st.side < 1e-3) st.sideSign = st.offset < 0 ? -1 : 1;
      st.side += ((side && !st.mine ? 1 : 0) - st.side) * ease(dt, SIDE_EASE);
      poseOrigin(pair.rival.p, pair.rival.view, pr);
      apart = Math.hypot(pr.x - pm.x, pr.z - pm.z);
      // how far apart across the view and along it (the camera's own right and forward)
      const az = c.azimuthAngle;
      dxR = Math.abs((pr.x - pm.x) * Math.cos(az) - (pr.z - pm.z) * Math.sin(az));
      dxF = Math.abs((pr.x - pm.x) * Math.sin(az) + (pr.z - pm.z) * Math.cos(az));
      pt.x = (pm.x + pr.x) / 2;
      pt.z = (pm.z + pr.z) / 2;
    }
    const sideW = smooth(Math.min(1, st.side));
    driveSide.w = sideW;
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
      st.mine = false;
    }
    // swung round after the travel direction, the same way behind it through a turn whatever
    // the frame rate
    st.course = follow(st.course, rawWas, st.raw, dt, 0.6);

    st.key += ((frozen ? 1 : 0) - st.key) * ease(dt, KEY_EASE);
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
    const d = c.distance;
    const fx = -((x0 + x1) / 2) * d * tanV * aspect;
    const fy = ((y0 + y1) / 2) * d * tanV;
    const kf = ease(dt, 0.35);
    st.fx += (fx - st.fx) * kf;
    st.fy += (fy - st.fy) * kf;
    void c.setFocalOffset(st.fx, st.fy, 0, false);

    // a chase distance that leaves room round the car for the other car and the road ahead
    // (scaled by however far the visitor has zoomed it since)
    let fit = (lane.p.dims.length * CHASE_SIZE) / ((y1 - y0) * tanV);
    if (pair) {
      // both cars inside the free part of the view: across it (its width) and along the road
      // (foreshortened up the view), with a car length to spare round each
      const len = lane.p.dims.length;
      const half = ((y1 - y0) / 2) * tanV;
      const across = (dxR / 2 + len) / (((x1 - x0) / 2) * tanV * aspect);
      const along = ((dxF / 2) * Math.cos(c.polarAngle) + len) / half;
      // from behind, never closer than the chase, nor than their distance apart up the view;
      // from the side, as close as both cars allow (the closer, the plainer the body's pitch)
      fit = Math.max(fit, Math.max((apart / 2 + len) / half, across, along) * PAIR_ROOM);
      if (sideW > 1e-3) {
        // (a car length up the view: room for the tags over the cars)
        const sideFit = Math.max(
          (dxR / 2 + SIDE_ROOM * len) / (((x1 - x0) / 2) * tanV * aspect),
          ((dxF / 2) * Math.cos(c.polarAngle) + len) / half,
        );
        fit += (sideFit - fit) * sideW;
      }
    }
    // the height it closes in from at the pause (from the side, still low)
    const keyPolar = KEY_POLAR + (KEY_SIDE_POLAR - KEY_POLAR) * sideW;
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
          (along * Math.cos(keyPolar) + KEY_ROOM) / (((y1 - y0) / 2) * tanV),
        );
      }
      fit += (st.kFit - fit) * st.key;
    }
    const handsOn = st.dragging || clock.elapsedTime - st.releasedAt < 0.6;
    if (handsOn) st.zoom = Math.max(0.2, Math.min(5, d / fit));
    else if (Math.abs(d - fit * st.zoom) > 0.01)
      void c.dollyTo(d + (fit * st.zoom - d) * ease(dt, 0.5), false);

    // camera-controls azimuth θ puts the camera at (sin θ, ·, cos θ) from the target;
    // straight behind a car travelling at angle χ is θ = χ − π/2 (its right side, θ = χ)
    const behind = st.course - Math.PI / 2;
    // the key moment from the side: SIDE_SWING off the tail, whatever the visitor's own offset
    const swing = (st.sideSign * SIDE_SWING - st.offset) * sideW;
    if (handsOn) {
      // the visitor's: the angle they leave it at is their offset (round the key moment, with
      // its height: the side view and the higher one are handed over to them)
      c.getSpherical(sph, true);
      st.offset = sph.theta - behind;
      if (st.pair > 1e-3 || st.side > 1e-3 || st.key > 1e-3) {
        st.mine = true;
        st.side = 0;
      }
    } else {
      c.azimuthAngle = behind + st.offset + swing;
    }
    // and from a little higher round the key moment (low, from the side), back to the visitor's
    // own height after
    if (st.pair < 1e-3 || handsOn || st.mine || !Number.isFinite(st.polar)) st.polar = c.polarAngle;
    else {
      const pairPolar = st.polar + (Math.min(st.polar, PAIR_POLAR) - st.polar) * st.pair;
      const sidePolar = pairPolar + (SIDE_POLAR - pairPolar) * sideW;
      // (lower at the pause, so the rings under the tyres show beside them)
      c.polarAngle = sidePolar + (keyPolar - sidePolar) * st.key;
    }
  }, CAMERA_PRIORITY);
}
