/**
 * The whole site is this one page: a car you can see through and click into.
 *   car ⇄ see-through (a switch: X, or click the car)  →(click a part)→  part   (Esc backs out)
 *   car  →(Drive)→  drive (the same car corners; settings in the hub)
 * Any of them can swap the car ([ ] or the picker) or compare it with others (?vs=).
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Box3, Raycaster, Vector2, type Group } from 'three';
import { getPartObject } from '../scene/registry';
import { useScene } from '../scene/store';
import { vehiclePose } from '../scene/runtime';
import { getEngine, getVehicle } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { useVehicleOverrides, withEngine } from '../vehicle3d';
import { useCompare, vsCars } from './compare';
import { DriveScene } from './drive/DriveScene';
import { useLegend } from './drive/Legend';
import { useDrive } from './drive/state';
import { FocusCamera } from './FocusCamera';
import { TrackScene } from './track/TrackScene';
import { Hud } from './Hud';
import { ModelProgress } from './ModelProgress';
import { RimLight } from './RimLight';
import { VehicleSlot } from './VehicleSlot';
import { backOut, isSeeThrough, useView, withSeeThrough, type Go, type View } from './view';
import { typing } from './keys';
import { leaveTour } from './tour/play';
import { stagedFor } from './tour/state';
import { TourPlayer } from './tour/TourPlayer';

/**
 * Moves the car to its drive-mode position and heading (identity otherwise). Roll and pitch are
 * applied by the vehicle model to the sprung body only, so the wheels stay on the road.
 */
function PoseGroup({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    if (vehiclePose.active) {
      g.position.set(vehiclePose.x, 0, vehiclePose.z);
      g.rotation.set(0, vehiclePose.yaw, 0);
    } else if (g.position.lengthSq() > 0 || g.rotation.y !== 0) {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
    }
  });
  return <group ref={ref}>{children}</group>;
}

/** how near the press (px) the engine still takes a click: beside it, a gearbox or a wheel got it */
const NEAR_PX = 24;
/** the press, then rings round it (px), nearest first */
const PROBES: [number, number][] = [
  [0, 0],
  ...[0.5, 1].flatMap((r) =>
    Array.from({ length: 8 }, (_, k): [number, number] => [
      r * NEAR_PX * Math.cos((k * Math.PI) / 4),
      r * NEAR_PX * Math.sin((k * Math.PI) / 4),
    ]),
  ),
];

/**
 * Which of the given parts (the engine, the motors) lies under the last press on the canvas, or
 * within a few pixels of it, if any, even behind something else: the box round each one is the
 * target, so a click on its outline or just beside it is a click on it.
 */
function usePointerUnits(): (ids: string[]) => string | undefined {
  const canvas = useThree((s) => s.gl.domElement);
  const camera = useThree((s) => s.camera);
  const at = useMemo(
    () => ({ ray: new Raycaster(), ndc: new Vector2(), x: 0, y: 0, set: false }),
    [],
  );
  useEffect(() => {
    // every press, so one on a part's label (which picks that part) leaves no stale canvas press
    const down = (e: PointerEvent) => {
      at.x = e.clientX;
      at.y = e.clientY;
      at.set = e.target === canvas;
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, [canvas, at]);
  return (ids) => {
    if (!at.set) return undefined;
    const r = canvas.getBoundingClientRect();
    const boxes: { id: string; box: Box3 }[] = [];
    for (const id of ids) {
      const o = getPartObject(id);
      const box = o && new Box3().setFromObject(o);
      if (box && !box.isEmpty()) boxes.push({ id, box });
    }
    for (const [dx, dy] of PROBES) {
      at.ndc.set(
        ((at.x + dx - r.left) / r.width) * 2 - 1,
        -((at.y + dy - r.top) / r.height) * 2 + 1,
      );
      at.ray.setFromCamera(at.ndc, camera);
      const hit = boxes.find((b) => at.ray.ray.intersectsBox(b.box));
      if (hit) return hit.id;
    }
    return undefined;
  };
}

/** Installs click/miss behaviour and per-level scene state (focus isolation, x-ray). */
function useExplorerSync(view: View, go: Go) {
  const vehicle = getVehicle(view.vehicleId);
  const zoomable = useMemo(
    () => new Set(layoutPowertrain(vehicle).parts.map((p) => p.id)),
    [vehicle],
  );
  // the engine or motors: a click that hits one of them and something in front picks them
  const units = useMemo(
    () =>
      layoutPowertrain(vehicle)
        .parts.filter((p) => p.kind === 'engine' || p.kind === 'motor')
        .map((p) => p.id),
    [vehicle],
  );
  const unitUnderPointer = usePointerUnits();
  const latest = useRef({ view, go, zoomable, units, unitUnderPointer });
  latest.current = { view, go, zoomable, units, unitUnderPointer };

  useEffect(() => {
    useScene.setState({
      onPick: (id) => {
        const { view: v, go: nav, zoomable: z } = latest.current;
        const top = id.split('/')[0];
        // clicking the car (or a car it is compared with) switches see-through on
        if (v.level === 'car') return nav(withSeeThrough(v, true), { replace: true });
        if (v.level === 'internals') {
          // the engine first: in see-through a gearbox, a diff or a wheel in front of it or
          // beside it caught the click
          const { units: u, unitUnderPointer: under } = latest.current;
          const unit = u.includes(top) ? top : under(u);
          if (unit) return nav({ ...v, level: 'part', part: unit, detail: undefined });
          // a compared car's parts ("vs1:engine") only highlight: zooming is the main car's
          if (z.has(top)) return nav({ ...v, level: 'part', part: top, detail: undefined });
        }
        const s = useScene.getState();
        s.select(s.selected === id ? null : id);
      },
      onMiss: () => {
        // empty-space click backs out of a zoomed part; elsewhere it only clears the selection
        // (when see-through, a near-miss on a small part shouldn't switch it off, and a near
        // miss on the engine opens it)
        const { view: v, go: nav, units: u, unitUnderPointer: under } = latest.current;
        if (v.level === 'part') return backOut(v, nav);
        const unit = v.level === 'internals' ? under(u) : undefined;
        if (unit) return nav({ ...v, level: 'part', part: unit, detail: undefined });
        useScene.getState().select(null);
      },
    });
    return () => useScene.setState({ onPick: null, onMiss: null });
  }, []);

  const prevLevel = useRef(view.level);
  useEffect(() => {
    const from = prevLevel.current;
    prevLevel.current = view.level;
    // dragging Explode on the painted car switches see-through on: keep where it was dragged
    const keepExplode = from === 'car' && view.level === 'internals';
    // a tour step opens its view exploded and with its parts picked out (and says which itself)
    const staged = stagedFor(view);
    useScene.setState({
      highlight: staged?.highlight ?? [],
      hovered: null,
      selected: null,
      ...(staged ? { explode: staged.explode } : keepExplode ? {} : { explode: 0 }),
      focus: view.level === 'part' ? (view.part ?? null) : null,
      // the engine stays a solid block in the see-through car (the one thing to find); only
      // zoomed into it does its casing turn to glass
      xray: view.level === 'part',
    });
    // see-through switched on: the engine (or motors) lights up and names itself for a moment
    if (from === 'car' && view.level === 'internals' && !staged) {
      const units = layoutPowertrain(vehicle)
        .parts.filter((p) => p.kind === 'engine' || p.kind === 'motor')
        .map((p) => p.id);
      useScene.getState().setHighlight(units);
      const t = window.setTimeout(() => {
        if (useScene.getState().highlight === units) useScene.getState().setHighlight([]);
      }, 2600);
      return () => window.clearTimeout(t);
    }
    // the level and part are what matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.level, view.part]);
}

export function Scene() {
  const [view, go] = useView();
  useExplorerSync(view, go);
  const vehicle = getVehicle(view.vehicleId);
  const vsKey = view.vs?.join(',') ?? '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vs = useMemo(() => vsCars(view.vs), [vsKey]);
  const mode = useCompare((s) => s.mode);
  return (
    <>
      <PoseGroup>
        <VehicleSlot
          vehicle={vehicle}
          // on a circuit the car is on show as it drives (the compared cars lap as ghosts)
          level={view.level === 'track' ? 'drive' : view.level}
          part={view.part}
          vs={view.level === 'drive' || view.level === 'track' ? undefined : vs}
        />
      </PoseGroup>
      {view.level === 'drive' && <DriveScene vehicle={vehicle} picked={view.vs} />}
      {view.level === 'track' && <TrackScene view={view} />}
      {(view.level === 'car' || view.level === 'internals' || view.level === 'part') && (
        <RimLight />
      )}
      <FocusCamera view={view} compare={vsKey && `${vsKey}|${mode}`} />
    </>
  );
}

export function Overlay() {
  const [view, go] = useView();
  const base = getVehicle(view.vehicleId);
  // an engine swap (inside view) must reach the engine panels and the sound too
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const vehicle = useMemo(() => withEngine(base, swap), [base, swap]);
  const pt = vehicle.powertrain;
  const engine = pt.kind === 'ice' ? getEngine(pt.engine) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      // a modal (the car sheet) owns the keys while it is open
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') {
        // one level at a time in drive: the legend closes, then the visitor stops driving, then
        // drive itself ends
        if (view.level === 'drive') {
          if (useLegend.getState().open) return;
          if (useDrive.getState().mode === 'drive') {
            useDrive.setState({ mode: 'watch', playing: true });
            return;
          }
        }
        // a tour playing: Esc ends it, back where the visitor was
        if (!leaveTour()) backOut(view, go);
      }
      // X: see-through on/off, wherever the car is on show (not while driving)
      else if (
        (e.code === 'KeyX' || e.key.toLowerCase() === 'x') &&
        !e.repeat &&
        view.level !== 'drive' &&
        view.level !== 'track'
      )
        go(withSeeThrough(view, !isSeeThrough(view)), { replace: view.level !== 'part' });
    };
    // capture: ahead of the drive legend's own Esc, so one press closes only the legend
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [view, go]);

  return (
    <>
      <ModelProgress vehicleId={base.id} others={view.level === 'drive' ? undefined : view.vs} />
      <Hud view={view} go={go} vehicle={vehicle} engine={engine} />
      {/* after the HUD: what a step sets once its view is open follows the HUD's own resets */}
      <TourPlayer view={view} />
    </>
  );
}
