import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-rs7-c8',
  name: 'Audi RS 7 Sportback (C8)',
  archetype: 'saloon',
  examples: ['Audi RS 6 Avant (C8)', 'Audi S6/S7 (C8)', 'Audi A8 (D5)'],
  dims: {
    wheelbaseMm: 2930,
    trackFMm: 1668,
    trackRMm: 1650,
    lengthMm: 5009,
    widthMm: 1950,
    heightMm: 1424,
    overhangFMm: 960,
  },
  // 285/30 R22 all round (the optional 22s the model wears; 275/35 R21 standard)
  // μ (lateral peak) 1.18, set so the sim's 100–0 km/h stop matches: 100–0 km/h 31.8 m cold / 29.2
  // m warm — Auto Bild Supertest, Jun 2024
  // kind: Conti SportContact 7 (Auto Bild)
  tires: { widthFMm: 285, widthRMm: 285, diameterMm: 730, mu: 1.18, kind: 'performance' },
  body: {
    style: 'fastback',
    tail: 'hatch',
    bonnetHMm: 960,
    beltHMm: 1000,
    cowlXMm: -520,
    roofFrontXMm: -1350,
    roofRearXMm: -2650,
    tailHMm: 1040,
    paint: '#5d6266',
  },
  bay: { widthMm: 1300, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ea825',
    // Audi's longitudinal layout: the whole V8 hangs ahead of the front axle, the front
    // differential sits between engine and gearbox.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 260,
    crankYMm: 470,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Permanent quattro: purely mechanical centre differential, 40:60 front:rear.
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    // the RS 6's Torsen-type diff: up to 70 % front or 85 % rear on slip (Audi MediaCenter)
    awdDevice: { type: 'torque-sensing', frontRange: [0.15, 0.7] },
    fuelTank: { litres: 73, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 535 },
  bodyCgFrac: 0.5,
  blurb:
    'A big V8 hung ahead of the front axle and a centre differential sending most of the torque rearward.',
  published: {
    curbKg: 2075,
    frontPct: 57.5,
    source:
      'Kerb 2075 kg without driver (441 kW RS 7, 2020) — Audi MediaCenter technical data; 5009 × 1950 × 1424 mm, wheelbase 2930 mm — Audi via autohled.cz; ~ tracks 1668/1650 mm as RS 6 C8; 40:60 centre-diff split and 48 V starter-generator (modelled as a plain ICE) — Audi; ~ 73 L tank; ~ 57.5/42.5 split estimated (reviews quote "almost 60:40")',
  },
};

export default v;
