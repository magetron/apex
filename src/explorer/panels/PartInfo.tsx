/**
 * Info card for a zoomed-in component that has no dedicated panel (gearbox, diffs,
 * coupling, wheels, battery, drive units, fuel tank). Chips + numbers derived from the spec.
 */
import { useMemo } from 'react';
import { Chips, Panel, Stat, Stats } from '../../app/ui';
import type { System } from '../../scene/palette';
import { getMotor } from '../../spec/catalog';
import { awdPartId } from '../../spec/derive/awd';
import { layoutPowertrain } from '../../spec/derive/layout';
import { massProps } from '../../spec/derive/mass';
import type { IcePowertrain, PlacedPart, VehicleSpec } from '../../spec/types';
import { withEngine } from '../../vehicle3d/fit';
import { useVehicleOverrides } from '../../vehicle3d/store';
import { torqueFlow } from '../../vehicle3d/torque';
import { AwdReadout } from './AwdPanel';
import '../../vehicle3d/panels.css';

const SYSTEM: Record<PlacedPart['kind'], System> = {
  engine: 'engine',
  gearbox: 'gearbox',
  diff: 'diff',
  coupling: 'coupling',
  motor: 'motor',
  battery: 'battery',
  'fuel-tank': 'fuel',
  wheel: 'wheel',
};

const GEARBOX: Record<IcePowertrain['gearbox'], string> = {
  'transverse-endon': 'Transverse, end-on',
  inline: 'Inline, behind the engine',
  'mid-transaxle': 'Transaxle with the diff',
  'rear-transaxle': 'Rear transaxle',
};

const cm = (mm: number) => Math.round(mm / 10);

export function PartInfo({ vehicle: base, part }: { vehicle: VehicleSpec; part: string }) {
  const swap = useVehicleOverrides((s) => s.engineSwap[base.id]);
  const vehicle = useMemo(() => withEngine(base, swap), [base, swap]);
  const layout = useMemo(() => layoutPowertrain(vehicle), [vehicle]);
  const flow = useMemo(() => torqueFlow(vehicle, layout), [vehicle, layout]);
  const total = useMemo(() => {
    try {
      return massProps(vehicle, layout).totalKg;
    } catch {
      return vehicle.published.curbKg;
    }
  }, [vehicle, layout]);
  // the part that splits torque between the axles gets the live AWD explainer
  const isAwd = useMemo(() => awdPartId(vehicle), [vehicle]) === part;
  const p = layout.parts.find((x) => x.id === part);
  if (!p) return null;
  const pt = vehicle.powertrain;
  const system = p.kind === 'wheel' && p.driven ? 'wheel-driven' : SYSTEM[p.kind];
  const chips: { label: string; system?: System; title?: string }[] = [];
  const stats: { label: string; value: string | number; unit?: string; title?: string }[] = [];
  const axleShare = (a?: string) => flow.axles.find((x) => x.axle === a)?.share ?? 0;

  if (p.kind !== 'wheel' && p.kg > 0)
    stats.push({ label: 'Mass', value: Math.round(p.kg), unit: 'kg' });
  if (p.kind !== 'wheel' && p.kg > 0)
    stats.push({
      label: 'Of kerb',
      value: ((100 * p.kg) / total).toFixed(1),
      unit: '%',
      title: 'share of the whole car',
    });

  switch (p.kind) {
    case 'wheel': {
      const front = p.axle === 'front';
      chips.push({ label: front ? 'Front axle' : 'Rear axle' });
      chips.push(
        p.driven
          ? { label: 'Driven', system: 'wheel-driven' }
          : { label: 'Not driven', system: 'wheel' },
      );
      stats.push({
        label: 'Tyre',
        value: front ? vehicle.tires.widthFMm : vehicle.tires.widthRMm,
        unit: 'mm',
      });
      stats.push({ label: 'Diameter', value: vehicle.tires.diameterMm, unit: 'mm' });
      if (p.driven)
        stats.push({
          label: 'Torque',
          value: Math.round((axleShare(p.axle) * 100) / 2),
          unit: '%',
          title: 'share of drive torque at this wheel',
        });
      stats.push({
        label: 'Corner',
        value: Math.round(p.kg),
        unit: 'kg',
        title: 'unsprung mass: wheel, tyre, brake, upright',
      });
      break;
    }
    case 'gearbox':
      if (pt.kind === 'ice') {
        chips.push({ label: GEARBOX[pt.gearbox], system: 'gearbox' });
        chips.push({ label: pt.orientation === 'transverse' ? 'Across the car' : 'Along the car' });
      }
      break;
    case 'diff':
      chips.push({ label: p.axle === 'front' ? 'Front axle' : 'Rear axle', system: 'diff' });
      if (p.kg === 0) chips.push({ label: 'Inside the gearbox case', system: 'gearbox' });
      if (!isAwd)
        stats.push({
          label: 'Torque',
          value: Math.round(axleShare(p.axle) * 100),
          unit: '%',
          title: 'share of drive torque through this diff',
        });
      break;
    case 'coupling':
      // the AWD readout names the device and its split
      break;
    case 'motor': {
      if (pt.kind === 'ev') {
        const m = pt.motors.find((x) => x.axle === p.axle);
        if (m) {
          const spec = getMotor(m.motor);
          chips.push({
            label:
              spec.kind === 'pmsm'
                ? 'Permanent magnet'
                : spec.kind === 'induction'
                  ? 'Induction'
                  : 'Reluctance',
            system: 'motor',
          });
          chips.push({ label: p.axle === 'front' ? 'Front axle' : 'Rear axle' });
          stats.push({ label: 'Peak', value: spec.peakKw, unit: 'kW' });
          stats.push({ label: 'Torque', value: spec.peakNm, unit: 'Nm' });
          stats.push({ label: 'Reduction', value: `${spec.reduction.toFixed(1)}:1` });
          stats.push({ label: 'Max', value: spec.maxRpm.toLocaleString('en-US'), unit: 'rpm' });
        }
      }
      break;
    }
    case 'battery':
      if (pt.kind === 'ev') {
        chips.push({ label: 'Under the floor', system: 'battery' });
        stats.push({ label: 'Energy', value: pt.battery.kWh, unit: 'kWh' });
        stats.push({
          label: 'Pack',
          value: Math.round((1000 * pt.battery.kWh) / pt.battery.massKg),
          unit: 'Wh/kg',
        });
        stats.push({ label: 'Height', value: pt.battery.heightMm, unit: 'mm' });
      }
      break;
    case 'fuel-tank':
      if (pt.kind === 'ice')
        stats.push({ label: 'Capacity', value: pt.fuelTank.litres, unit: 'L' });
      chips.push({
        label:
          p.posMm[0] > -vehicle.dims.wheelbaseMm / 2
            ? 'Ahead of mid-wheelbase'
            : 'Behind mid-wheelbase',
        system: 'fuel',
      });
      break;
  }
  stats.push({ label: 'Size', value: p.sizeMm.map(cm).join('×'), unit: 'cm' });
  stats.push({
    label: 'From front axle',
    value: Math.round(-p.posMm[0]),
    unit: 'mm',
    title: 'centre position, + behind the front axle',
  });

  const allChips = [
    { label: system === 'wheel-driven' ? 'Driven wheel' : p.kind.replace('-', ' '), system },
    ...chips,
  ];
  return (
    <Panel title={p.label}>
      {isAwd ? <AwdReadout vehicle={vehicle} chips={allChips} /> : <Chips items={allChips} />}
      <Stats>
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} unit={s.unit} title={s.title} />
        ))}
      </Stats>
    </Panel>
  );
}
