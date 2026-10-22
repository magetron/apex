import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'alfa-romeo-4c-960',
  name: 'Alfa Romeo 4C (Type 960)',
  archetype: 'sports',
  examples: [
    'Alfa Romeo 4C Spider',
    'Lotus Elise / Exige (S2, S3)',
    'Toyota MR2 (W30)',
    'Fiat X1/9',
  ],
  years: '2013–2020',
  dims: {
    wheelbaseMm: 2380,
    trackFMm: 1639,
    trackRMm: 1604,
    lengthMm: 3989,
    widthMm: 1864,
    heightMm: 1183,
    // ~ measured on the scaled model
    overhangFMm: 865,
  },
  // 205/45 R17 front, 235/40 R18 rear
  // μ (lateral peak) 1.08, set so the sim's 100–0 km/h stop matches: 60–0 mph 99 ft ≈ 32.4 m from
  // 100 km/h — MotorWeek road test, 2015
  // ~ kind: OE Pirelli P Zero
  tires: { widthFMm: 205, widthRMm: 235, diameterMm: 630, mu: 1.08, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'engine-deck',
    bonnetHMm: 720,
    beltHMm: 820,
    cowlXMm: -450,
    roofFrontXMm: -950,
    roofRearXMm: -1550,
    tailHMm: 950,
    paint: '#b0141c',
  },
  bay: { widthMm: 1150, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-1750-tbi',
    // A front-drive engine + twin-clutch unit turned into a rear drive: across the car, behind
    // the seats, its differential on the rear axle line.
    position: 'mid',
    orientation: 'transverse',
    engineXMm: -2180,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 75,
    driven: 'rear',
    fuelTank: { litres: 40, xMm: -1600 },
  },
  // Pre-preg carbon tub with aluminium front and rear subframes.
  chassis: 'carbon-tub',
  suspension: { front: 'double-wishbone', rear: 'macpherson' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 110 },
  bodyCgFrac: 0.5,
  blurb:
    'A hatchback-style engine and gearbox set across the car behind the seats, on a carbon tub.',
  published: {
    curbKg: 940,
    frontPct: 40,
    source:
      'Wheelbase 2380, track 1639/1604, 3989 × 1864 × 1183 mm, 40 L tank, 205/45 R17 + 235/40 R18 — Alfa Romeo spec sheets (EU 2013, US 2014) via fiat500usa.com; kerb 940 kg (Wikipedia "Alfa Romeo 4C"; 895 kg dry per Alfa); 40/60 split — Alfa launch release via AROC UK (Wikipedia gives 38/62); ~ gearbox on the left as in Alfa’s front-drive installs; ~ overhang and engine position estimated',
  },
};

export default v;
