import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-z4-g29',
  name: 'BMW Z4 M40i (G29)',
  archetype: 'roadster',
  examples: ['Toyota GR Supra (A90, same platform)', 'BMW Z4 sDrive30i (inline-4)'],
  dims: {
    wheelbaseMm: 2470,
    trackFMm: 1609,
    trackRMm: 1616,
    lengthMm: 4324,
    widthMm: 1864,
    heightMm: 1304,
    overhangFMm: 909, // measured on the 3D model (length and wheelbase match BMW data)
  },
  // 255/35 R19 front, 275/35 R19 rear
  tires: { widthFMm: 255, widthRMm: 275, diameterMm: 661, mu: 1.05 },
  body: {
    style: 'roadster',
    tail: 'notch',
    bonnetHMm: 860,
    beltHMm: 920,
    cowlXMm: -900,
    roofFrontXMm: -1250,
    roofRearXMm: -1900,
    tailHMm: 980,
    // Frozen Grey
    paint: '#868b8e',
  },
  bay: { widthMm: 1200, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'i6',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -330,
    crankYMm: 420,
    gearbox: 'inline',
    gearboxKg: 85,
    driven: 'rear',
    fuelTank: { litres: 52, xMm: -1950 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 281 },
  bodyCgFrac: 0.55,
  blurb:
    'A short-wheelbase roadster: inline-6 behind the front axle, driver sitting close to the rear axle.',
  published: {
    curbKg: 1535,
    frontPct: 50.6,
    source:
      'Dims 2470 wb / 4324 × 1864 × 1304 mm, kerb 1535 kg (BMW South Africa technical data) — via Wikipedia "BMW Z4 (G29)"; 50.6/49.4 measured by Sport Auto (Supertest); B58 at 285 kW as in the US/2023 car; ~ overhang',
  },
};

export default v;
