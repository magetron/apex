/**
 * Flies the camera to frame whatever the view is about, clear of the HUD (the breadcrumb too).
 * One car view: switching see-through never moves the camera. Another car, or a step back from
 * a part, frames the whole car again, from the visitor's angle while that still shows the layout
 * (else from the arrival angle); a car's parts are framed where they end up, not mid-slide. An
 * engine opens from where its cylinder layout reads. Arriving (first load, back from drive) sets
 * the default angle; comparing cars, the angle of the visitor's view preset, through a long lens.
 * A zoomed part keeps clear of the panels as they grow. The visitor orbits no lower than a little
 * above the ground (drive and the hot lap keep their own cameras).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import {
  Box3,
  Fog,
  Spherical,
  type Group,
  type Mesh,
  type Object3D,
  type PerspectiveCamera,
  type ShaderMaterial,
} from 'three';
import { frameObject, type FrameOptions } from '../scene/CameraRig';
import { allPartObjects, getPartObject } from '../scene/registry';
import { useScene } from '../scene/store';
import { getEngine, getVehicle } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { withEngine } from '../vehicle3d/fit';
import { useVehicleOverrides } from '../vehicle3d/store';
import { useModelLoad } from '../vehicle3d/gltf/load';
import { useGhostOutlines } from '../vehicle3d/GhostCar';
import { gltfUrl } from '../vehicle3d/gltf/manifest';
import { compareFov, useCompare, VIEW_ANGLES } from './compare';
import {
  engineView,
  ORBIT_FLOOR,
  showsLayout,
  SIDE_FLOOR,
  spotOf,
  stillSince,
  type Spot,
} from './framing';
import { freeWindow } from './freeWindow';
import { useTour, type CameraAsk } from './tour/state';
import type { Level, View } from './view';

/** the car view with see-through on or off is one framing */
type Scope = 'car' | 'part' | 'drive' | 'track';
// (a hot lap's own camera does all of its framing)
const scopeOf = (l: Level): Scope => (l === 'internals' ? 'car' : l);

/** on arrival: from high on the right, mostly side-on: the whole car, engine and all, at a glance */
// (see-through, the engine shows whether it sits in the nose, the middle or the tail)
const ARRIVE = { azimuth: Math.PI * 0.2, polar: Math.PI * 0.28 };

const FRAMING: Record<Scope, FrameOptions> = {
  // the whole car with some air round it (a tight frame read as too close)
  car: { padding: 0.22 },
  // fill the view with the part
  part: { padding: 0.25 },
  // a chase distance (~9 m) and height; the drive scene's chase camera takes over the azimuth
  drive: { azimuth: Math.PI * 0.2, polar: Math.PI * 0.3, padding: 0.75 },
  track: {},
};

/** the breadcrumb and its hint (and a tour's bar): a framed car stays clear of them */
const TRAIL = '.apx-dock--top-left > *, .apx-tour';

/** Where the vehicle's engine (as swapped, if it is) shows its cylinder layout. */
function engineAngles(vehicleId: string): FrameOptions | null {
  const base = getVehicle(vehicleId);
  const v = withEngine(base, useVehicleOverrides.getState().engineSwap[base.id]);
  const pt = v.powertrain;
  const part = layoutPowertrain(v).parts.find((p) => p.kind === 'engine');
  return pt.kind === 'ice' && part ? engineView(getEngine(pt.engine), part) : null;
}

/** visible, and every ancestor too (an isolated or hidden part must not stretch the frame) */
function shownInScene(o: Object3D): boolean {
  for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * What to frame: the part; else every visible part (the wheels stand outside the body, an
 * exploded car spreads in all directions, compared cars stand beside it); in drive, the body.
 */
function targets(view: View): Object3D[] {
  if (view.level === 'part' && view.part) return [getPartObject(view.part)].filter((o) => !!o);
  if (view.level !== 'drive') return allPartObjects().filter(shownInScene);
  return [getPartObject('body')].filter((o): o is Object3D => !!o);
}

const hasBounds = (objs: Object3D[]) => {
  const box = new Box3();
  for (const o of objs) box.union(new Box3().setFromObject(o));
  return !box.isEmpty();
};

/** The explode amount once the slider has rested (no camera chase while it is dragged). */
function useSettledExplode(level: Level): number {
  const explode = useScene((s) => s.explode);
  const [settled, setSettled] = useState(explode);
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(explode), 300);
    return () => window.clearTimeout(t);
  }, [explode]);
  // only a zoomed part follows its explode; the car view keeps still while it explodes (a camera
  // that swings with the slider loses the visitor), and the visitor zooms out if they want to
  return level === 'part' ? Math.round(settled * 10) : 0;
}

/** The floor grid's fade-out distance (drei <Grid>), found once in the scene. */
type FadeUniform = { value: number };
function gridFade(scene: Object3D): FadeUniform | null {
  let u: FadeUniform | null = null;
  scene.traverse((o) => {
    const uniforms = ((o as Mesh).material as ShaderMaterial | undefined)?.uniforms;
    if (!u && uniforms?.fadeDistance && uniforms.worldCamProjPosition) u = uniforms.fadeDistance;
  });
  return u;
}

/**
 * While cars are compared, a long lens: the field of view narrows and the camera backs off by
 * the same factor in the same frame (a dolly zoom: the cars keep their size on screen), so a car
 * parked further away no longer looks smaller. The fog and the floor grid's fade move back with
 * the camera. All of it returns when the comparison ends.
 */
function useCompareLens(cars: number) {
  const on = cars > 1;
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const normal = useRef<number | null>(null);
  const fogged = useRef<{ fog: Fog; near: number; far: number } | null>(null);
  const grid = useRef<{ u: FadeUniform; base: number } | null>(null);
  useFrame(() => {
    // the lens changes with the camera's distance in one step (and only once the camera
    // controls are up, on a deep link straight into a comparison)
    if (normal.current === null) normal.current = camera.fov;
    const lens = cars > 1 ? compareFov(cars) : normal.current;
    const c = useScene.getState().controls;
    if (c && Math.abs(camera.fov - lens) > 1e-3) {
      const k = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((lens * Math.PI) / 360);
      camera.fov = lens;
      camera.updateProjectionMatrix();
      void c.dollyTo(c.distance * k, false);
    }
    const fog = scene.fog;
    const f = fogged.current;
    const g = grid.current;
    if (!on) {
      if (f) {
        f.fog.near = f.near;
        f.fog.far = f.far;
        fogged.current = null;
      }
      if (g) {
        g.u.value = g.base;
        grid.current = null;
      }
      return;
    }
    const d = useScene.getState().controls?.distance ?? 0;
    // (a theme change brings a new fog)
    if (fog instanceof Fog) {
      if (f?.fog !== fog) fogged.current = { fog, near: fog.near, far: fog.far };
      fog.near = Math.max(fogged.current!.near, d * 1.3);
      fog.far = Math.max(fogged.current!.far, d * 3.5);
    }
    if (!g) {
      const u = gridFade(scene);
      if (u) grid.current = { u, base: u.value };
    }
    if (grid.current) grid.current.u.value = Math.max(grid.current.base, d * 1.8);
  });
}

/**
 * Calmer orbiting in the explorer: a short drag turned the car a quarter turn and coasted on.
 * Half the turn per pixel, a camera that stops soon after the pointer does, and (`floor`, the
 * lowest polar angle; null leaves the rig's own) no sliding down to the ground.
 */
function useCalmOrbit(floor: number | null) {
  const controls = useScene((s) => s.controls);
  useEffect(() => {
    if (!controls) return;
    const was = {
      az: controls.azimuthRotateSpeed,
      polar: controls.polarRotateSpeed,
      drift: controls.draggingSmoothTime,
      fly: controls.smoothTime,
    };
    controls.azimuthRotateSpeed = 0.5;
    // up and down turns slower than round: a sideways drag that wanders a little stays level
    controls.polarRotateSpeed = 0.35;
    // the lag behind the pointer, which is also the coast after letting go
    controls.draggingSmoothTime = 0.03;
    // quicker flights between views (they took seconds to settle)
    controls.smoothTime = 0.28;
    return () => {
      controls.azimuthRotateSpeed = was.az;
      controls.polarRotateSpeed = was.polar;
      controls.draggingSmoothTime = was.drift;
      controls.smoothTime = was.fly;
    };
  }, [controls]);
  useEffect(() => {
    if (!controls || floor === null) return;
    const was = controls.maxPolarAngle;
    controls.maxPolarAngle = floor;
    return () => {
      controls.maxPolarAngle = was;
    };
  }, [controls, floor]);
}

/** the HUD's panel columns: a zoomed part reframes when one grows or shrinks */
const PANEL_SLOTS = '.apx-slot-left, .apx-slot-center, .apx-slot-right, .apx-dock--top-right';

/**
 * The room the HUD leaves (freeWindow), coarsely, while `on`: it changes when a panel grows over
 * the view or shrinks from it (a fold opened in the hub, the canvas resized), not as text inside
 * one changes.
 */
function useHudRoom(canvas: HTMLElement, on: boolean): string {
  const [room, setRoom] = useState('');
  useEffect(() => {
    if (!on) return;
    const measure = () => {
      const w = freeWindow(canvas, 1.6, 0.4, TRAIL);
      // in steps of ~4% of the view: a panel a few pixels taller doesn't move the camera
      setRoom(w ? w.map((v) => Math.round(v * 12)).join(',') : 'none');
    };
    // the room as the part opens (no reframe for it: the opening frames it), then its changes
    measure();
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(measure, 250);
    });
    for (const el of document.querySelectorAll(PANEL_SLOTS)) ro.observe(el);
    ro.observe(canvas);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, [canvas, on]);
  return on ? room : '';
}

/**
 * Where the framed pieces stand (their middle and spread), to tell when they have stopped moving:
 * the targets themselves, or zoomed into a part, every group in it (its exploding parts, the
 * valvetrain and manifolds riding out with them). Their placings, not their shapes: a running
 * engine and spinning wheels don't count as moving.
 */
function spotNow(view: View, objs: Object3D[]): Spot | null {
  const pts: [number, number, number][] = [];
  const add = (o: Object3D) => {
    const e = o.matrixWorld.elements;
    pts.push([e[12], e[13], e[14]]);
  };
  const root = view.level === 'part' ? objs[0] : undefined;
  if (root)
    root.traverseVisible((o) => {
      if ((o as Group).isGroup) add(o);
    });
  else objs.forEach(add);
  return spotOf(pts);
}

export function FocusCamera({ view, compare = '' }: { view: View; compare?: string }) {
  const canvas = useThree((s) => s.gl.domElement);
  // a detailed model that streams in changes the car's bounds: frame again once it's there
  // (the compared cars' too)
  const urls = [view.vehicleId, ...(view.level === 'drive' ? [] : (view.vs ?? []))]
    .map(gltfUrl)
    .filter((u): u is string => !!u);
  const ready = useModelLoad((s) => urls.filter((u) => s[u]?.state === 'ready').length);
  // exploding moves parts outward: frame again once the slider rests, so none leave the view
  const explode = useSettledExplode(view.level);
  // picking a circuit, the car is on show as in the car view
  const scope = view.level === 'track' && !view.track ? 'car' : scopeOf(view.level);
  // comparing (in the car view): the visitor's preset says where to look from
  const mode = useCompare((s) => s.mode);
  const preset = useCompare((s) => s.view);
  const comparing = scope === 'car' && !!view.vs?.length;
  useCalmOrbit(
    scope === 'car' || scope === 'part'
      ? comparing && preset === 'side'
        ? SIDE_FLOOR
        : ORBIT_FLOOR
      : null,
  );
  useCompareLens(comparing ? view.vs!.length + 1 : 0);
  const lens = comparing ? `${preset}|${mode}|${view.vs!.join(',')}` : '';
  // an overlay's outlines are built in a worker after their models load (a frame taken before
  // left the outline sticking out of the view): frame again as each one arrives
  const outlines = useGhostOutlines((s) => (comparing && mode === 'overlay' ? s.built : 0));
  // zoomed into a part, the car's body is hidden: its model arriving doesn't move the camera (it
  // reframed an engine seconds after a car swap), unless the part is a wheel, which it draws
  const model = scope !== 'part' || !!view.part?.startsWith('wheel') ? ready : '-';
  // a zoomed part keeps clear of the panels as they grow (a fold opened in the hub)
  const room = useHudRoom(canvas, scope === 'part');
  // a tour step's angle (or the camera to put back as the tour ends)
  const ask = useTour((s) => s.camera);
  const key = `${view.vehicleId}|${scope}|${view.part ?? ''}|${model}|${explode}|${lens}|${outlines}|${compare}|${room}|${ask?.seq ?? 0}`;
  /**
   * The framing the view had before (scope, car, explode); whether the car has been framed since
   * arriving; and an angle still to fly to (a preset picked, a comparison ended, an engine
   * opened) once there is something to frame.
   */
  const last = useRef<{
    scope: Scope | null;
    vehicle: string | null;
    explode: number;
    framed: boolean;
    lens: string;
    outlines: number;
    angles: FrameOptions | null;
    /** a swap or a step back still to check the angle for (survives the model arriving) */
    check: boolean;
    /** not before (performance.now()): a new car's parts sliding in, an explode spreading */
    settleBy: number;
    /** a tour's ask still to frame by, and the last one taken */
    ask: CameraAsk | null;
    askSeq: number;
  }>({
    scope: null,
    vehicle: null,
    explode: 0,
    framed: false,
    lens: '',
    outlines: 0,
    angles: null,
    check: false,
    settleBy: 0,
    ask: null,
    askSeq: 0,
  });
  useEffect(() => {
    const prev = last.current.scope;
    const swapped = last.current.vehicle !== null && last.current.vehicle !== view.vehicleId;
    const exploded = explode !== last.current.explode;
    const opened = scope === 'part' && (prev !== 'part' || swapped);
    last.current.scope = scope;
    last.current.vehicle = view.vehicleId;
    last.current.explode = explode;
    if (ask && ask.seq !== last.current.askSeq) {
      last.current.askSeq = ask.seq;
      last.current.ask = ask;
    }
    const away = (s: Scope | null) => s === 'drive' || s === 'track';
    if (away(scope) || away(prev)) last.current.framed = false;
    if (scope === 'track') return;
    if (scope === 'car' && (lens !== last.current.lens || !last.current.framed)) {
      // a new comparison, preset or mode (or arriving with one) looks from its preset; the end
      // of one from the front three-quarter again (a plan view suits two cars, not one)
      last.current.angles = lens ? VIEW_ANGLES[preset] : last.current.lens ? ARRIVE : null;
      last.current.lens = lens;
    }
    // an outline that arrives just after a preset was picked: from the preset still (the camera
    // may be mid-flight to it)
    if (scope === 'car' && lens && outlines !== last.current.outlines)
      last.current.angles = VIEW_ANGLES[preset];
    last.current.outlines = outlines;
    // opening the engine: from where its cylinder layout reads
    if (opened && view.part === 'engine') last.current.angles = engineAngles(view.vehicleId);
    // another car, or back from a part: the whole car, from the visitor's angle only if that
    // still shows its layout (not from behind, below or straight down)
    if (scope === 'car' && !lens && (swapped || prev === 'part')) last.current.check = true;
    if (scope !== 'car') last.current.check = false;
    // a new car's parts slide to their places, an explode spreads out: frame where they end up
    // (framed mid-way, the camera looked at empty space where the next car's engine had been).
    // The wait outlasts another change meanwhile (the new car's model arriving), which used to
    // cut it short. A zoomed part jumps to its place in the next car: it is framed once it rests.
    const now = performance.now();
    if ((swapped && scope !== 'part') || exploded) last.current.settleBy = now + 650;
    const wait = Math.max(80, last.current.settleBy - now);
    const frame = (objs: Object3D[]) => {
      const c = useScene.getState().controls;
      // where the camera is heading (mid-flight to an engine's angle, a reframe goes on there)
      const end = c?.getSpherical(new Spherical(), true);
      const heading = end ? { azimuth: end.theta, polar: end.phi } : {};
      const arrive = scope === 'car' && !last.current.framed;
      const lost = last.current.check && !!end && !showsLayout(end.theta, end.phi);
      last.current.check = false;
      const angles = scope === 'car' || scope === 'part' ? last.current.angles : null;
      // a tour's ask: an angle to frame from, or the camera exactly as it was before the tour
      const asked = scope === 'car' || scope === 'part' ? last.current.ask : null;
      if (scope !== 'drive') last.current.framed = true;
      last.current.angles = null;
      last.current.ask = null;
      if (asked?.look && c) {
        const [px, py, pz] = asked.look.position;
        const [tx, ty, tz] = asked.look.target;
        void c.setLookAt(px, py, pz, tx, ty, tz, true);
        return;
      }
      const o = {
        ...FRAMING[scope],
        ...(scope === 'drive' ? {} : heading),
        ...(arrive || lost ? ARRIVE : {}),
        ...(angles ?? {}),
        ...(asked?.angles ?? {}),
      };
      // drive keeps a chase distance; elsewhere fit into the room the HUD leaves, clear of
      // the breadcrumb too (cars side by side seen from above stand as tall as they are long)
      const free =
        scope === 'drive'
          ? undefined
          : freeWindow(canvas, comparing && preset === 'top' ? 1.1 : 1.6, 0.4, TRAIL);
      void frameObject(objs, { ...o, window: free });
    };
    // then frame by frame until they rest (at most 90 frames more: the parts' own easing runs
    // per frame, so a slow device or a background tab waits as long in frames), at least two
    // frames so the render loop has run since (leaving Drive, the car only returns from down the
    // road there; a timer alone also fires in a background tab, where no frame runs). Driving,
    // the car never rests: two frames.
    const rests = scope === 'car' || scope === 'part';
    let raf = 0;
    const t = window.setTimeout(() => {
      // nothing there yet (a model still streaming has no bounds): frame once it is, for a few
      // seconds (a part's model arriving no longer frames again)
      const giveUp = performance.now() + 8000;
      let before: Spot | null = null;
      let calm = 0;
      let frames = 0;
      const poll = () => {
        const objs = targets(view);
        const there = objs.length > 0 && hasBounds(objs);
        if (there) frames++;
        if (rests) {
          const spot = there ? spotNow(view, objs) : null;
          calm = stillSince(before, spot) ? calm + 1 : 0;
          before = spot;
        }
        const waiting = there
          ? frames < 90 && (rests ? calm < 2 : frames < 2)
          : performance.now() < giveUp;
        if (waiting) {
          raf = requestAnimationFrame(poll);
          return;
        }
        if (there) frame(objs);
      };
      raf = requestAnimationFrame(poll);
    }, wait);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
    // the key captures every field that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
