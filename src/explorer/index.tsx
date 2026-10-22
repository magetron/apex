/**
 * The whole site is this one page: a car you can click into.
 *   car  →(click car)→  internals  →(click a part)→  part   (Esc / click empty space = back out)
 *   car  →(Drive)→      drive (the same car corners; settings in the hub)
 */
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { useScene } from '../scene/store';
import { vehiclePose } from '../scene/runtime';
import { getEngine, getVehicle } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { useVehicleOverrides, withEngine } from '../vehicle3d';
import { DriveScene } from './drive/DriveScene';
import { FocusCamera } from './FocusCamera';
import { Hud } from './Hud';
import { ModelProgress } from './ModelProgress';
import { VehicleSlot } from './VehicleSlot';
import { useView, zoomOut, type View } from './view';

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
function useExplorerSync(view: View, go: (v: View) => void) {
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
        if (v.level === 'car') return nav({ vehicleId: v.vehicleId, level: 'internals' });
        if (v.level === 'internals' && z.has(top))
          return nav({ vehicleId: v.vehicleId, level: 'part', part: top });
        const s = useScene.getState();
        s.select(s.selected === id ? null : id);
      },
      onMiss: () => {
        // empty-space click backs out of a zoomed part; elsewhere it only clears the selection
        // (at "internals" a near-miss on a small part shouldn't throw you out)
        const { view: v, go: nav } = latest.current;
        const up = v.level === 'part' ? zoomOut(v) : null;
        if (up) nav(up);
        else useScene.getState().select(null);
      },
    });
    return () => useScene.setState({ onPick: null, onMiss: null });
  }, []);

  useEffect(() => {
    useScene.getState().resetView();
    useScene.setState({
      focus: view.level === 'part' ? (view.part ?? null) : null,
      xray: view.level === 'internals' || view.level === 'part',
    });
  }, [view.level, view.part]);
}

export function Scene() {
  const [view, go] = useView();
  useExplorerSync(view, go);
  const vehicle = getVehicle(view.vehicleId);
  return (
    <>
      <PoseGroup>
        <VehicleSlot vehicle={vehicle} level={view.level} part={view.part} />
      </PoseGroup>
      {view.level === 'drive' && <DriveScene vehicle={vehicle} />}
      <FocusCamera view={view} />
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
      if (e.key !== 'Escape') return;
      const up = zoomOut(view);
      if (up) go(up);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, go]);

  return (
    <>
      <ModelProgress vehicleId={base.id} />
      <Hud view={view} go={go} vehicle={vehicle} engine={engine} />
    </>
  );
}
