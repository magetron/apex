/** Short human-readable summaries of specs, shared by pages, tours and readouts. */
import { getEngine } from './catalog';
import type { BalanceReport, VehicleSpec } from './types';

const POS_LETTER = {
  'front-overhang': 'F',
  'front-mid': 'F',
  mid: 'M',
  'rear-overhang': 'R',
  'rear-underfloor': 'R',
} as const;

/** "FF", "FR", "MR", "RR", "F-AWD", "M-AWD", "EV-AWD"… */
export function layoutCode(v: VehicleSpec): string {
  const pt = v.powertrain;
  const drive = pt.driven === 'all' ? 'AWD' : pt.driven === 'front' ? 'F' : 'R';
  if (pt.kind === 'ev') return `EV-${drive === 'AWD' ? 'AWD' : drive + 'WD'}`;
  const pos = POS_LETTER[pt.position];
  return drive === 'AWD' ? `${pos}-AWD` : `${pos}${drive}`;
}

const POS_TEXT = {
  'front-overhang': 'ahead of the front axle',
  'front-mid': 'behind the front axle',
  mid: 'ahead of the rear axle',
  'rear-overhang': 'behind the rear axle',
  'rear-underfloor': 'under the boot floor at the rear',
} as const;

export type FactKind = 'orientation' | 'engine' | 'position' | 'drive' | 'motors' | 'battery';

/** The layout as short facts (render as chips, not prose), always derived from the spec. */
export function layoutFacts(v: VehicleSpec): { kind: FactKind; label: string }[] {
  const pt = v.powertrain;
  const drive =
    pt.driven === 'all'
      ? 'All-wheel drive'
      : pt.driven === 'front'
        ? 'Front-wheel drive'
        : 'Rear-wheel drive';
  if (pt.kind === 'ev') {
    return [
      { kind: 'motors', label: `${pt.motors.length} motor${pt.motors.length > 1 ? 's' : ''}` },
      { kind: 'battery', label: `${pt.battery.kWh} kWh floor battery` },
      { kind: 'drive', label: drive },
    ];
  }
  return [
    { kind: 'engine', label: getEngine(pt.engine).name },
    { kind: 'orientation', label: pt.orientation === 'transverse' ? 'Transverse' : 'Longitudinal' },
    { kind: 'position', label: POS_TEXT[pt.position].replace(/^./, (c) => c.toUpperCase()) },
    { kind: 'drive', label: drive },
  ];
}

/** One-line verdict on an engine's balance, for readouts. */
export function balanceSummary(b: BalanceReport): string {
  const parts: string[] = [];
  const f = (x: number) => x.toFixed(1);
  if (b.primary.force > 0.05) parts.push(`1st-order shake ${f(b.primary.force)}×`);
  if (b.secondary.force > 0.05) parts.push(`2nd-order shake ${f(b.secondary.force)}×`);
  if (b.primary.couple > 0.05)
    parts.push(
      `1st-order rocking ${f(b.primary.couple)}${b.primary.coupleRotating ? ' (counterweight-able)' : ''}`,
    );
  if (b.secondary.couple > 0.05) parts.push(`2nd-order rocking ${f(b.secondary.couple)}`);
  return parts.length ? parts.join(' · ') : 'Perfectly balanced';
}
