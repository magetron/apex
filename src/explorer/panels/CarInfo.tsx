/**
 * Info card at the car and internals levels: facts + numbers, no prose.
 * Inside, it also carries the overlay toggles and the engine swap with its live fit check.
 */
import { useMemo } from 'react';
import { Button, Chips, Panel, Select, Stat, Stats, Tag } from '../../app/ui';
import type { OverlayKind } from '../../content/types';
import type { System } from '../../scene/palette';
import { getEngine, listEngines } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { layoutCode, layoutFacts, type FactKind } from '../../spec/describe';
import type { MassProps, VehicleSpec } from '../../spec/types';
import { checkFit, withEngine, type FitAxis } from '../../vehicle3d/fit';
import { useVehicleOverrides } from '../../vehicle3d/store';
import '../../vehicle3d/panels.css';

const FACT_SYSTEM: Partial<Record<FactKind, System>> = {
  engine: 'engine',
  drive: 'wheel-driven',
  motors: 'motor',
  battery: 'battery',
};

const OVERLAYS: { kind: OverlayKind; label: string; title: string }[] = [
  { kind: 'cg', label: 'CG', title: 'Centre of gravity' },
  { kind: 'torque-flow', label: 'Torque', title: 'Torque flow to the driven wheels' },
  { kind: 'axle-loads', label: 'Axle loads', title: 'Static load on each axle' },
  { kind: 'inertia', label: 'Yaw inertia', title: 'Polar moment: how hard the car is to rotate' },
  { kind: 'floorplan', label: 'Floor plan', title: 'Cabin vs drivetrain footprint' },
  { kind: 'dimensions', label: 'Dimensions', title: 'Wheelbase, overhangs, track' },
  { kind: 'bay-fit', label: 'Bay fit', title: 'Engine + gearbox vs the engine bay' },
];

function safeMass(v: VehicleSpec): MassProps | null {
  try {
    return massProps(v);
  } catch {
    return null;
  }
}

function SplitBar({ frontPct }: { frontPct: number }) {
  const f = Math.max(0, Math.min(100, frontPct));
  return (
    <div className="wp3-split" title="static weight on the front / rear axle">
      <div
        className="wp3-split__bar"
        role="img"
        aria-label={`${f.toFixed(1)}% front, ${(100 - f).toFixed(1)}% rear`}
      >
        <i style={{ width: `${f}%` }} />
        <i style={{ width: `${100 - f}%` }} />
      </div>
      <div className="wp3-split__legend">
        <span>F {f.toFixed(1)}%</span>
        <span>R {(100 - f).toFixed(1)}%</span>
      </div>
    </div>
  );
}

const fitText = (a: FitAxis) => `${Math.round(a.need)} / ${Math.round(a.have)}`;

function EngineSwap({ vehicle }: { vehicle: VehicleSpec }) {
  const pt = vehicle.powertrain;
  const swap = useVehicleOverrides((s) => s.engineSwap[vehicle.id]);
  const setEngine = useVehicleOverrides((s) => s.setEngine);
  const overlays = useVehicleOverrides((s) => s.overlays);
  const setOverlays = useVehicleOverrides((s) => s.setOverlays);
  const fit = useMemo(() => checkFit(vehicle, swap), [vehicle, swap]);
  if (pt.kind !== 'ice' || !fit) return null;
  const own = pt.engine;
  const options = listEngines().map((e) => ({
    value: e.id,
    label: e.id === own ? `${e.name} (original)` : e.name,
  }));
  const pick = (id: string) => {
    setEngine(vehicle.id, id === own ? null : id);
    if (id !== own && !overlays.includes('bay-fit')) setOverlays([...overlays, 'bay-fit']);
  };
  const orient = pt.orientation === 'transverse' ? 'transverse' : 'longitudinal';
  return (
    <>
      <div className="wp3-row">
        <Select
          label={`Engine swap · ${orient}`}
          value={swap ?? own}
          options={options}
          onChange={pick}
        />
        {swap && <Button onClick={() => setEngine(vehicle.id, null)}>Reset</Button>}
      </div>
      <div className="wp3-fit" aria-label="Fit in the engine bay">
        <span
          className={`is-${fit.across.status}`}
          title="engine package width across the car / free bay width (mm)"
        >
          {fitText(fit.across)}
          <small>across</small>
        </span>
        <span
          className={`is-${fit.along.status}`}
          title="engine package length along the car / free bay length (mm)"
        >
          {fitText(fit.along)}
          <small>along</small>
        </span>
        <span
          className={`is-${fit.height.status === 'clash' ? 'clash' : 'ok'}`}
          title="engine top / bonnet line above ground (mm)"
        >
          {fitText(fit.height)}
          <small>height</small>
        </span>
        <span className={`is-${fit.status}`}>{fit.status === 'ok' ? 'fits' : fit.status}</span>
      </div>
    </>
  );
}

function OverlayToggles() {
  const overlays = useVehicleOverrides((s) => s.overlays);
  const toggle = useVehicleOverrides((s) => s.toggleOverlay);
  return (
    <div className="wp3-toggles" role="group" aria-label="Overlays">
      {OVERLAYS.map((o) => (
        <button
          key={o.kind}
          type="button"
          aria-pressed={overlays.includes(o.kind)}
          title={o.title}
          onClick={() => toggle(o.kind)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CarInfo({ vehicle: base, detailed }: { vehicle: VehicleSpec; detailed: boolean }) {
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const vehicle = useMemo(() => withEngine(base, detailed ? swap : null), [base, swap, detailed]);
  const m = useMemo(() => safeMass(vehicle), [vehicle]);
  const pt = vehicle.powertrain;
  const k = m ? Math.sqrt(m.izzKgM2 / m.totalKg) : 0;
  return (
    <Panel title={base.name} actions={<Tag>{layoutCode(vehicle)}</Tag>}>
      <Chips
        items={layoutFacts(vehicle).map((f) => ({
          label:
            f.kind === 'engine' && pt.kind === 'ice' && swap && detailed
              ? `${getEngine(pt.engine).name} (swapped)`
              : f.label,
          system: FACT_SYSTEM[f.kind],
        }))}
      />
      {m && <SplitBar frontPct={m.frontPct} />}
      {detailed && m && (
        <Stats>
          <Stat label="Kerb" value={Math.round(m.totalKg)} unit="kg" />
          <Stat label="CG height" value={Math.round(m.cgMm[1])} unit="mm" />
          <Stat
            label="Yaw inertia"
            value={Math.round(m.izzKgM2)}
            unit="kg·m²"
            title="resistance to turning (polar moment)"
          />
          <Stat
            label="Gyration"
            value={k.toFixed(2)}
            unit="m"
            title="radius of gyration √(Izz/m): the dumbbell half-length"
          />
        </Stats>
      )}
      {!detailed && (
        <Stats>
          <Stat label="Wheelbase" value={base.dims.wheelbaseMm} unit="mm" />
          <Stat label="Length" value={base.dims.lengthMm} unit="mm" />
          <Stat label="Kerb" value={base.published.curbKg} unit="kg" />
          {(base.luggageL.front || base.luggageL.rear) && (
            <Stat
              label="Boot"
              // front + rear where a car has both (mid- and rear-engined cars, EVs)
              value={[base.luggageL.front, base.luggageL.rear].filter((l) => l).join(' + ')}
              unit="L"
            />
          )}
        </Stats>
      )}
      {detailed && <OverlayToggles />}
      {detailed && <EngineSwap vehicle={base} />}
    </Panel>
  );
}
