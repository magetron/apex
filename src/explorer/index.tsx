/**
 * The whole site is this one page: a car you can see through and click into.
 *   car ⇄ see-through (a switch: X, or click the car)  →(click a part)→  part   (Esc backs out)
 *   car  →(Drive)→  drive (the same car corners; settings in the hub)
 * Any of them can swap the car ([ ] or the picker) or compare it with others (?vs=).
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useScene } from '../scene/store';
import { vehiclePose } from '../scene/runtime';
import { getEngine, getVehicle } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { useVehicleOverrides, withEngine } from '../vehicle3d';
import { useCompare, vsCars } from './compare';
import { DriveScene } from './drive/DriveScene';
import { FocusCamera } from './FocusCamera';
import { Hud } from './Hud';
import { ModelProgress } from './ModelProgress';
import { VehicleSlot } from './VehicleSlot';
import { backOut, isSeeThrough, useView, withSeeThrough, type Go, type View } from './view';

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

/** Installs click/miss behaviour and per-level scene state (focus isolation, x-ray). */
function useExplorerSync(view: View, go: Go) {
  const vehicle = getVehicle(view.vehicleId);
  const zoomable = useMemo(
    () => new Set(layoutPowertrain(vehicle).parts.map((p) => p.id)),
    [vehicle],
  );
  const latest = useRef({ view, go, zoomable });
  latest.current = { view, go, zoomable };

  useEffect(() => {
    useScene.setState({
      onPick: (id) => {
        const { view: v, go: nav, zoomable: z } = latest.current;
        const top = id.split('/')[0];
        // clicking the car (or a car it is compared with) switches see-through on
        if (v.level === 'car') return nav(withSeeThrough(v, true), { replace: true });
        // a compared car's parts ("vs1:engine") only highlight: zooming is the main car's
        if (v.level === 'internals' && z.has(top))
          return nav({ ...v, level: 'part', part: top, detail: undefined });
        const s = useScene.getState();
        s.select(s.selected === id ? null : id);
      },
      onMiss: () => {
        // empty-space click backs out of a zoomed part; elsewhere it only clears the selection
        // (when see-through, a near-miss on a small part shouldn't switch it off)
        const { view: v, go: nav } = latest.current;
        if (v.level === 'part') backOut(v, nav);
        else useScene.getState().select(null);
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
    useScene.setState({
      highlight: [],
      hovered: null,
      selected: null,
      ...(keepExplode ? {} : { explode: 0 }),
      focus: view.level === 'part' ? (view.part ?? null) : null,
      xray: isSeeThrough(view),
    });
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
          level={view.level}
          part={view.part}
          vs={view.level === 'drive' ? undefined : vs}
        />
      </PoseGroup>
      {view.level === 'drive' && <DriveScene vehicle={vehicle} picked={view.vs} />}
      <FocusCamera view={view} compare={vsKey && `${vsKey}|${mode}`} />
    </>
  );
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);

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
      if (e.key === 'Escape') backOut(view, go);
      // X: see-through on/off, wherever the car is on show (not while driving)
      else if (
        (e.code === 'KeyX' || e.key.toLowerCase() === 'x') &&
        !e.repeat &&
        view.level !== 'drive'
      )
        go(withSeeThrough(view, !isSeeThrough(view)), { replace: view.level !== 'part' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, go]);

  return (
    <>
      <ModelProgress vehicleId={base.id} others={view.level === 'drive' ? undefined : view.vs} />
      <Hud view={view} go={go} vehicle={vehicle} engine={engine} />
    </>
  );
}
