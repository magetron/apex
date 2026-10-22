import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-r8-v10-gen2',
  name: 'Audi R8 V10 performance quattro (Gen 2)',
  archetype: 'supercar',
  examples: ['Lamborghini Huracán (shared platform)'],
  dims: {
    wheelbaseMm: 2650,
    trackFMm: 1645,
    trackRMm: 1599,
    lengthMm: 4429,
    widthMm: 1940,
    heightMm: 1236,
    overhangFMm: 995,
  },
  // μ (lateral peak) 1.11, set so the sim's 100–0 km/h stop matches: 100–0 km/h 32 m — fastestlaps
  // (R8 V10 performance quattro; magazine not shown)
  // ~ kind: OE Pirelli P Zero
  tires: { widthFMm: 245, widthRMm: 305, diameterMm: 655, mu: 1.11, kind: 'performance' },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 760,
    beltHMm: 850,
    cowlXMm: -300,
    roofFrontXMm: -950,
    roofRearXMm: -1650,
    tailHMm: 1050,
    paint: '#eeeeea',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v10',
    position: 'mid',
    orientation: 'longitudinal',
    // Ahead of the rear axle; the transaxle behind it straddles the axle line.
    engineXMm: -2050,
    crankYMm: 360,
    gearbox: 'mid-transaxle',
    gearboxKg: 140,
    driven: 'all',
    // Rear driven through the transaxle; an electro-hydraulic multi-plate clutch in the front
    // differential sends the front axle anything up to all of the torque.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.3,
    awdDevice: { type: 'clutch', frontRange: [0, 1] },
    fuelTank: { litres: 83, xMm: -250 },
  },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 112 },
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  bodyCgFrac: 0.54,
  blurb:
    'A mid-engined V10 with a driven front axle: a prop shaft runs forward from the transaxle.',
  published: {
    curbKg: 1595,
    frontPct: 42,
    source:
      'Kerb 1595 kg without driver (1670 kg with), 4429 × 1940 × 1236 mm, wb 2650, tracks 1645/1599, 83 L — Audi technical data, R8 Coupé V10 performance quattro 456 kW (05/2024) and V10 RWD (2020); Wikipedia lists 1650 kg for the 2019 coupé; front-axle clutch in the front diff, up to 100 % of the torque to either axle — Audi MediaCenter (R8 Spyder V10, drivetrain), ~ 30:70 nominal split estimated; ~ 42/58 split: Audi quotes 40:60 for the 1590 kg RWD, and quattro adds ~50 kg of front drive hardware; ~ front overhang measured on the Green Hell model',
  },
};

export default v;
