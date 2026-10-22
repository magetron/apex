import type { MotorSpec } from '../../types';

// The SU7 Ultra's rear axle carries TWO V8s motors, one per wheel, in a single drive-unit
// housing. The powertrain contract allows one motor per axle, so this spec is the pair.
const motor: MotorSpec = {
  id: 'xiaomi-v8s-twin',
  name: 'Twin HyperEngine V8s (one per rear wheel)',
  kind: 'pmsm',
  examples: ['Xiaomi SU7 Ultra rear unit', 'Tesla Model S Plaid rear unit (two motors)'],
  peakKw: 850,
  peakNm: 1270,
  maxRpm: 27200,
  reduction: 10.5,
  lengthMm: 820,
  diameterMm: 330,
  massKg: 160,
  sound: { polePairs: 4, inverterHz: 12000, gearWhine: 0.45 },
  source:
    'V8s: 425 kW / 635 Nm each, 27 200 rpm, 10.14 kW/kg (motor alone ≈ 42 kg) — Xiaomi via Wikipedia "Xiaomi SU7"; rear total 850 kW / 1270 Nm — evspecifications.com; ~ reduction (27 200 rpm near the 350 km/h top speed), twin drive-unit size and 160 kg mass (2 motors + 2 reductions + inverters) estimated',
};

export default motor;
