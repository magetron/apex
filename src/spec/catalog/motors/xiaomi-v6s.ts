import type { MotorSpec } from '../../types';

const motor: MotorSpec = {
  id: 'xiaomi-v6s',
  name: 'HyperEngine V6s',
  kind: 'pmsm',
  examples: ['Xiaomi SU7 Ultra front unit', 'Xiaomi SU7 Max rear unit'],
  peakKw: 288,
  peakNm: 500,
  maxRpm: 21000,
  reduction: 8.0,
  lengthMm: 620,
  diameterMm: 300,
  massKg: 85,
  sound: { polePairs: 4, inverterHz: 10000, gearWhine: 0.4 },
  source:
    'SU7 Ultra front motor 288 kW (1138 kW total minus 2 × 425 kW) / 500 Nm (1770 Nm total minus 2 × 635 Nm), 21 000 rpm — Xiaomi via Wikipedia "Xiaomi SU7" and evspecifications.com; ~ reduction (21 000 rpm at the 350 km/h top speed), drive-unit size, mass and pole pairs estimated',
};

export default motor;
