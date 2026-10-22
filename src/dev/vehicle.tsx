/**
 * Vehicle sandbox (#/dev/vehicle): any catalog car at any zoom level, overlay toggles, engine swap,
 * camera presets for silhouette checks, and a line-up of every body side by side.
 */
import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { Button, Dock, Panel, Segmented, Select, Slider, Toggle } from '../app/ui';
import type { CameraPreset, OverlayKind } from '../content/types';
import type { Level } from '../explorer/view';
import { CarInfo } from '../explorer/panels/CarInfo';
import { PartInfo } from '../explorer/panels/PartInfo';
import { useScene } from '../scene/store';
import { listVehicles } from '../spec/catalog';
import { layoutPowertrain } from '../spec/derive/layout';
import { mm } from '../spec/units';
import { BodyShell } from '../vehicle3d/Body';
import { CAMERA_PRESETS, framePreset } from '../vehicle3d/camera';
import { getShell } from '../vehicle3d/shell/build';
import { useVehicleOverrides } from '../vehicle3d/store';
import { VehicleModel } from '../vehicle3d/VehicleModel';
import { Wheel } from '../vehicle3d/Wheel';

const OVERLAYS: { kind: OverlayKind; label: string }[] = [
  { kind: 'cg', label: 'CG' },
  { kind: 'torque-flow', label: 'Torque flow' },
  { kind: 'axle-loads', label: 'Axle loads' },
  { kind: 'dimensions', label: 'Dimensions' },
  { kind: 'inertia', label: 'Yaw inertia' },
  { kind: 'floorplan', label: 'Floor plan' },
  { kind: 'bay-fit', label: 'Bay fit' },
];

type Mode = Level | 'lineup';

interface Sandbox {
  vehicleId: string;
  mode: Mode;
  part: string;
  set: (p: Partial<Omit<Sandbox, 'set'>>) => void;
}

const useSandbox = create<Sandbox>()((set) => ({
  vehicleId: 'porsche-911-992',
  mode: 'car',
  part: 'engine',
  set: (p) => set(p),
}));

const VIEWS = CAMERA_PRESETS;
const frame = (view: CameraPreset) => framePreset(view);

// drive the sandbox from the console while iterating on shapes
if (import.meta.env.DEV)
  Object.assign(window as unknown as Record<string, unknown>, {
    __vehicle: useSandbox,
    __vehicleFrame: frame,
  });

function Lineup() {
  const cars = listVehicles();
  const cols = 7;
  return (
    <>
      {cars.map((v, i) => {
        const sh = getShell(v);
        const L = mm(v.dims.wheelbaseMm);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * 5.6;
        const z = (row - 1.5) * 3.2;
        return (
          <group key={v.id} position={[x + L / 2, 0, z]}>
            <BodyShell vehicle={v} shell={sh} exterior stages={4} />
            {layoutPowertrain(v)
              .parts.filter((p) => p.kind === 'wheel')
              .map((p) => {
                const R = mm(p.sizeMm[0] / 2);
                return (
                  <group key={p.id} position={[mm(p.posMm[0]), mm(p.posMm[1]), mm(p.posMm[2])]}>
                    <Wheel
                      R={R}
                      w={mm(p.sizeMm[2])}
                      rimR={R * 0.72}
                      side={Math.sign(p.posMm[2]) || 1}
                      driven={false}
                      xray={false}
                      caliperAft
                      spin={false}
                    />
                  </group>
                );
              })}
            <Html
              position={[-L / 2, mm(v.dims.heightMm) + 0.25, 0]}
              center
              style={{ pointerEvents: 'none' }}
            >
              <span
                className="apx-tag"
                style={{ background: 'var(--label-bg)', whiteSpace: 'nowrap' }}
              >
                {v.name.replace(/\s*\(.*\)$/, '')}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

export function Scene() {
  const { vehicleId, mode, part } = useSandbox();
  const vehicle = listVehicles().find((v) => v.id === vehicleId) ?? listVehicles()[0];
  useEffect(() => {
    useScene.getState().resetView();
    useScene.setState({
      focus: mode === 'part' ? part : null,
      xray: mode === 'internals' || mode === 'part',
    });
    const t = window.setTimeout(() => (mode === 'lineup' ? undefined : frame('front-3q')), 120);
    return () => window.clearTimeout(t);
  }, [mode, part, vehicleId]);
  if (mode === 'lineup') return <Lineup />;
  return <VehicleModel vehicle={vehicle} level={mode} part={mode === 'part' ? part : undefined} />;
}

export function Overlay() {
  const { vehicleId, mode, part, set } = useSandbox();
  const vehicles = listVehicles();
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const { explode, setExplode } = useScene();
  const { overlays, toggleOverlay } = useVehicleOverrides();
  const parts = useMemo(
    () => layoutPowertrain(vehicle).parts.map((p) => ({ value: p.id, label: p.label })),
    [vehicle],
  );
  return (
    <>
      <Dock side="top-left">
        <Panel title="Vehicle sandbox">
          <Select
            label="Car"
            value={vehicleId}
            options={vehicles.map((v) => ({ value: v.id, label: v.name }))}
            onChange={(id) => set({ vehicleId: id })}
          />
          <Segmented<Mode>
            label="Level"
            value={mode}
            onChange={(m) => set({ mode: m })}
            options={[
              { value: 'car', label: 'Car' },
              { value: 'internals', label: 'Inside' },
              { value: 'part', label: 'Part' },
              { value: 'lineup', label: 'Line-up' },
            ]}
          />
          {mode === 'part' && (
            <Select label="Part" value={part} options={parts} onChange={(p) => set({ part: p })} />
          )}
          {(mode === 'internals' || mode === 'part') && (
            <Slider
              label="Explode"
              value={explode}
              min={0}
              max={1}
              onChange={setExplode}
              format={(x) => `${Math.round(x * 100)}%`}
            />
          )}
          <div className="apx-row">
            {(Object.keys(VIEWS) as CameraPreset[])
              .filter((k) => k !== 'underside')
              .map((k) => (
                <Button key={k} onClick={() => frame(k)}>
                  {k}
                </Button>
              ))}
          </div>
        </Panel>
        {mode === 'internals' && (
          <Panel title="Overlays">
            {OVERLAYS.map((o) => (
              <Toggle
                key={o.kind}
                label={o.label}
                checked={overlays.includes(o.kind)}
                onChange={() => toggleOverlay(o.kind)}
              />
            ))}
          </Panel>
        )}
      </Dock>
      <Dock side="top-right">
        {mode === 'part' ? (
          <PartInfo vehicle={vehicle} part={part} />
        ) : (
          <CarInfo vehicle={vehicle} detailed={mode === 'internals'} />
        )}
      </Dock>
    </>
  );
}
