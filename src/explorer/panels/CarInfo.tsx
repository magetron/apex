/**
 * Info card for the car view: facts + numbers, no prose. See-through, it also carries the
 * overlay toggles and the engine swap with its live fit check; compared, a table of the cars.
 */
import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { Button, Panel, Select, Stat, Stats } from '../../app/ui';
import type { OverlayKind } from '../../content/types';
import { SYSTEM_COLORS, SYSTEM_LABELS, type System } from '../../scene/palette';
import { layoutPowertrain } from '../../spec/derive/layout';
import { getEngine, listEngines } from '../../spec/catalog';
import { massProps } from '../../spec/derive/mass';
import { layoutFacts, type FactKind } from '../../spec/describe';
import type { IcePowertrain, MassProps, VehicleSpec } from '../../spec/types';
import { SYSTEM_OF } from '../../vehicle3d/Drivetrain';
import { checkFit, withEngine, type FitAxis } from '../../vehicle3d/fit';
import { useVehicleOverrides } from '../../vehicle3d/store';
import type { Go, View } from '../view';
import { carFacts, engineShort } from './carFacts';
import { Glyph } from './CarPicker';
import { CompareMore, CompareTable } from './Compare';
import { carLessons } from './lessons';
import { Why } from './Why';
import '../../vehicle3d/panels.css';
import '../explorer.css';

const FACT_SYSTEM: Partial<Record<FactKind, System>> = {
  engine: 'engine',
  drive: 'wheel-driven',
  motors: 'motor',
  battery: 'battery',
};

/**
 * Where the engine sits, as a chip names it: one word for the layout ("Rear overhang" read as a
 * body feature, not where the engine is). The picture beside it shows the finer place.
 */
const POSITION: Record<IcePowertrain['position'], string> = {
  'front-overhang': 'Front-engine',
  'front-mid': 'Front-mid',
  mid: 'Mid-engine',
  'rear-overhang': 'Rear-engine',
  'rear-underfloor': 'Rear-engine',
};

const OVERLAYS: { kind: OverlayKind; label: string; title: string }[] = [
  { kind: 'cg', label: 'CG', title: 'Centre of gravity' },
  { kind: 'torque-flow', label: 'Torque', title: 'Torque to the wheels' },
  { kind: 'axle-loads', label: 'Axle loads', title: 'Static axle loads' },
  { kind: 'inertia', label: 'Yaw inertia', title: 'Polar moment of inertia' },
  { kind: 'floorplan', label: 'Floor plan', title: 'Cabin vs drivetrain' },
  { kind: 'dimensions', label: 'Dimensions', title: 'Wheelbase, overhangs, track' },
  { kind: 'bay-fit', label: 'Bay fit', title: 'Engine package vs bay' },
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
    <div className="veh-split" title="Static axle loads">
      <div
        className="veh-split__bar"
        role="img"
        aria-label={`${f.toFixed(1)}% front, ${(100 - f).toFixed(1)}% rear`}
      >
        <i style={{ width: `${f}%` }} />
        <i style={{ width: `${100 - f}%` }} />
      </div>
      <div className="veh-split__legend">
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
      <div className="veh-row">
        <Select
          label={`Engine swap · ${orient}`}
          value={swap ?? own}
          options={options}
          onChange={pick}
        />
        {swap && <Button onClick={() => setEngine(vehicle.id, null)}>Reset</Button>}
      </div>
      {/* the installed package (gearbox and ancillaries too), not the bare engine's size */}
      <div className="veh-fit" aria-label="Fit in the engine bay">
        <span className={`is-${fit.across.status}`} title="Package / bay width, mm">
          {fitText(fit.across)}
          <small>across</small>
        </span>
        <span className={`is-${fit.along.status}`} title="Package / bay length, mm">
          {fitText(fit.along)}
          <small>along</small>
        </span>
        <span
          className={`is-${fit.height.status === 'clash' ? 'clash' : 'ok'}`}
          title="Engine top / bonnet line, mm"
        >
          {fitText(fit.height)}
          <small>height</small>
        </span>
        <span className={`is-${fit.status}`}>{fit.status === 'ok' ? 'fits' : fit.status}</span>
      </div>
    </>
  );
}

/** the legend's order: what drives first, then what carries it to the wheels, then the rest */
const LEGEND_ORDER: System[] = [
  'engine',
  'motor',
  'gearbox',
  'shaft',
  'diff',
  'coupling',
  'wheel-driven',
  'battery',
  'fuel',
];

/** a 16 × 16 line drawing of a system, in its colour */
const glyph = (d: ReactNode) => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    {d}
  </svg>
);

/** The legend's picture and word for each system (the scene's names are longer). */
const LEGEND: Partial<Record<System, { word: string; icon: ReactNode }>> = {
  engine: {
    word: 'Engine',
    icon: glyph(
      <>
        <rect x="2" y="6" width="12" height="7.5" rx="1.5" />
        <path d="M5 6V3.5h6V6" />
      </>,
    ),
  },
  motor: {
    word: 'Motor',
    icon: glyph(
      <>
        <rect x="1.5" y="4" width="13" height="8" rx="4" />
        <path d="M8.8 5.6L6.6 8.4h2.8L7.2 10.8" />
      </>,
    ),
  },
  gearbox: {
    word: 'Gearbox',
    icon: glyph(
      <>
        <circle cx="8" cy="8" r="3.4" />
        <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4L5 5M11 11l1.6 1.6M3.4 12.6L5 11M11 5l1.6-1.6" />
      </>,
    ),
  },
  shaft: {
    word: 'Shafts',
    icon: glyph(
      <>
        <path d="M1.5 8h13" />
        <circle cx="4.5" cy="8" r="1.8" />
        <circle cx="11.5" cy="8" r="1.8" />
      </>,
    ),
  },
  diff: {
    word: 'Diffs',
    icon: glyph(<path d="M8 3l5 5-5 5-5-5zM1 8h2M13 8h2" />),
  },
  coupling: {
    word: 'Coupling',
    icon: glyph(<path d="M6.5 3v10M9.5 3v10M1.5 8h5M9.5 8h5" />),
  },
  'wheel-driven': {
    word: 'Driven',
    icon: glyph(
      <>
        <circle cx="8" cy="8" r="6" />
        <circle cx="8" cy="8" r="2.2" />
      </>,
    ),
  },
  battery: {
    word: 'Battery',
    icon: glyph(
      <>
        <rect x="1.5" y="4.5" width="11.5" height="7" rx="1" />
        <path d="M14.5 7v2" />
      </>,
    ),
  },
  fuel: {
    word: 'Fuel',
    icon: glyph(<path d="M8 2.2S3.6 7.2 3.6 10a4.4 4.4 0 0 0 8.8 0C12.4 7.2 8 2.2 8 2.2z" />),
  },
};

/** The parts this car shows see-through: a picture in each one's colour and a word. */
function PartLegend({ vehicle }: { vehicle: VehicleSpec }) {
  const systems = useMemo(() => {
    const layout = layoutPowertrain(vehicle);
    const have = new Set<System>(
      layout.parts.filter((p) => p.kind !== 'wheel').map((p) => SYSTEM_OF[p.kind]),
    );
    if (layout.shafts.length) have.add('shaft');
    have.add('wheel-driven');
    return LEGEND_ORDER.filter((s) => have.has(s));
  }, [vehicle]);
  // the tank is drawn in grey glass in the car (in its own red-orange it read as the engine)
  return (
    <div className="apx-legend apx-legend--icons">
      {systems.map((s) => (
        <span
          key={s}
          title={SYSTEM_LABELS[s]}
          style={{ '--sys': SYSTEM_COLORS[s === 'fuel' ? 'chassis' : s] } as CSSProperties}
        >
          {LEGEND[s]?.icon ?? <i />}
          {LEGEND[s]?.word ?? SYSTEM_LABELS[s]}
        </span>
      ))}
    </div>
  );
}

/** the overlays up front: where the weight and the drive go */
const MAIN_OVERLAYS: OverlayKind[] = ['cg', 'torque-flow', 'axle-loads'];

/**
 * Another car starts with only the main overlays the visitor kept: the extras under More (yaw
 * inertia, floor plan…) were opened for the last car, and stayed on over the next one.
 */
export function useMoreOverlaysReset(vehicleId: string) {
  const last = useRef(vehicleId);
  useEffect(() => {
    if (last.current === vehicleId) return;
    last.current = vehicleId;
    const { overlays, setOverlays } = useVehicleOverrides.getState();
    const kept = overlays.filter((k) => MAIN_OVERLAYS.includes(k));
    if (kept.length !== overlays.length) setOverlays(kept);
  }, [vehicleId]);
}

function OverlayToggles({ kinds }: { kinds: (k: OverlayKind) => boolean }) {
  const overlays = useVehicleOverrides((s) => s.overlays);
  const toggle = useVehicleOverrides((s) => s.toggleOverlay);
  return (
    <div className="veh-toggles" role="group" aria-label="Overlays">
      {OVERLAYS.filter((o) => kinds(o.kind)).map((o) => (
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

/** Rows that open in place inside the card (see-through), rather than a different card. */
function Reveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={open ? 'apx-reveal is-open' : 'apx-reveal'} inert={!open} aria-hidden={!open}>
      <div>{children}</div>
    </div>
  );
}

/**
 * One card for the car view, up front only what answers where the engine is, which wheels
 * drive and what that does: the layout chips, the weight split, why it matters and (see-through)
 * the colour legend and the CG, torque and axle-load overlays. Sizes, the other overlays and the
 * engine swap wait under More. Compared with other cars, a table of every car with the
 * differences: the layout rows up front, the engine, power and mass under More.
 */
export function CarInfo({
  vehicle: base,
  detailed,
  view,
  go,
  others,
}: {
  vehicle: VehicleSpec;
  detailed: boolean;
  /** for the comparison (switch the main car, drop one) */
  view?: View;
  go?: Go;
  /** the cars it is compared with */
  others?: VehicleSpec[];
}) {
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const vehicle = useMemo(() => withEngine(base, detailed ? swap : null), [base, swap, detailed]);
  const m = useMemo(() => safeMass(vehicle), [vehicle]);
  const pt = vehicle.powertrain;
  const comparing = !!(others?.length && view && go);
  const facts = carFacts(base);
  const lessons = useMemo(() => carLessons(facts), [facts]);
  const unit = useMemo(
    () => layoutPowertrain(base).parts.find((p) => p.kind === 'engine' || p.kind === 'motor')?.id,
    [base],
  );
  return (
    <Panel title={base.name}>
      <div className="apx-chips">
        {layoutFacts(vehicle).map((f) => {
          const system = FACT_SYSTEM[f.kind];
          const style = system ? ({ '--sys': SYSTEM_COLORS[system] } as CSSProperties) : undefined;
          // three words at most: the engine as the picker names it, the position as a code
          const label =
            pt.kind !== 'ice'
              ? f.label
              : f.kind === 'engine'
                ? `${swap && detailed ? '⇄ ' : ''}${engineShort(getEngine(pt.engine))}`
                : f.kind === 'position'
                  ? POSITION[pt.position]
                  : f.label;
          // where the engine sits and which wheels drive, drawn as the picker draws them
          const icon =
            f.kind === 'position' ? (
              <Glyph places={facts.places} unit="engine" />
            ) : f.kind === 'drive' ? (
              <Glyph drive={facts.drive} />
            ) : (
              system && <i />
            );
          // the engine (or motors) chip opens the engine, like a click on it in the car
          const open =
            (f.kind === 'engine' || f.kind === 'motors') && view && go && unit
              ? () => go({ vehicleId: base.id, level: 'part', part: unit, vs: view.vs })
              : undefined;
          return open ? (
            <button
              key={f.kind}
              type="button"
              className="apx-chip is-link"
              style={style}
              title={`Open the ${f.kind === 'engine' ? 'engine' : 'motor'}`}
              onClick={open}
            >
              {icon}
              {label}
            </button>
          ) : (
            <span key={f.kind} className="apx-chip" style={style}>
              {icon}
              {label}
            </span>
          );
        })}
      </div>
      {m && <SplitBar frontPct={m.frontPct} />}
      {comparing && <CompareTable view={view!} go={go!} vehicle={base} others={others!} />}
      {!comparing && view && go && <Why lessons={lessons} view={view} go={go} />}
      <Reveal open={detailed}>
        <PartLegend vehicle={vehicle} />
        <OverlayToggles kinds={(k) => MAIN_OVERLAYS.includes(k)} />
      </Reveal>
      <details className="apx-more">
        <summary>More</summary>
        <div className="apx-more__body">
          {comparing && <CompareMore vehicle={base} others={others!} />}
          {!comparing && (
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
              {m && <Stat label="CG height" value={Math.round(m.cgMm[1])} unit="mm" />}
            </Stats>
          )}
          {detailed && <OverlayToggles kinds={(k) => !MAIN_OVERLAYS.includes(k)} />}
          {detailed && pt.kind === 'ice' && <EngineSwap vehicle={base} />}
        </div>
      </details>
    </Panel>
  );
}
