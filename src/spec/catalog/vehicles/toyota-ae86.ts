import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'toyota-ae86',
  name: 'Toyota Sprinter Trueno GT-APEX (AE86)',
  archetype: 'sports',
  examples: ['Toyota Corolla Levin (AE86)', 'Toyota GR86 (spiritual successor)'],
  years: '1983–1987',
  dims: {
    wheelbaseMm: 2400,
    trackFMm: 1355,
    trackRMm: 1345,
    lengthMm: 4205,
    widthMm: 1625,
    heightMm: 1335,
    // measured on the 3D model (its length matches Toyota's 4205 mm)
    overhangFMm: 845,
  },
  // 185/60 R14
  // ~ μ (lateral peak) 0.83, set so the sim's 100–0 km/h stop matches: ~43 m from 100 km/h (~0.92
  // g: 1983 185/60 R14 radials, no ABS); no figure found
  // kind: 185/60 R14 (period)
  tires: { widthFMm: 185, widthRMm: 185, diameterMm: 578, mu: 0.83, kind: 'road' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 830,
    beltHMm: 900,
    cowlXMm: -560,
    roofFrontXMm: -1150,
    roofRearXMm: -2250,
    tailHMm: 1000,
    paint: '#f3f3ee',
  },
  bay: { widthMm: 1000, lengthMm: 850 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-4age',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -120,
    crankYMm: 390,
    gearbox: 'inline',
    gearboxKg: 35,
    driven: 'rear',
    fuelTank: { litres: 50, xMm: -2300 },
  },
  chassis: 'monocoque',
  // Rear: four-link live axle on coil springs.
  suspension: { front: 'macpherson', rear: 'solid-axle' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 300 },
  bodyCgFrac: 0.48,
  // The live axle's beam and diff carrier ride with the wheels.
  extraMasses: [
    { id: 'axle-housing', label: 'Live rear-axle housing', kg: 30, posMm: [-2400, 289, 0] },
  ],
  blurb: 'A light front-engine, rear-drive coupé with a live rear axle: why drifters love it.',
  published: {
    curbKg: 950,
    frontPct: 53,
    source:
      'Dims 2400 wb / 4205 × 1625 × 1335 mm, live 4-link rear axle — Toyota via Wikipedia "Toyota AE86"; kerb 950 kg and 53/47 split — aeu86.org specifications (enthusiast sheet, ~); ~ tracks and tank; ~ front overhang from the 3D model',
  },
};

export default v;
