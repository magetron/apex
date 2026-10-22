import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-718-boxster-t-982',
  name: 'Porsche 718 Boxster T (982)',
  archetype: 'roadster',
  examples: [
    'Porsche 718 Cayman (982c, the coupé twin)',
    'Porsche Boxster (986, 987, 981)',
    'Alpine A110 (mid-engine I4)',
  ],
  years: '2019–2023',
  dims: {
    wheelbaseMm: 2475,
    trackFMm: 1515,
    trackRMm: 1532,
    lengthMm: 4379,
    widthMm: 1801,
    heightMm: 1281,
    // ~ measured on the model
    overhangFMm: 1000,
  },
  // 235/35 ZR20 front, 265/35 ZR20 rear
  tires: { widthFMm: 235, widthRMm: 265, diameterMm: 672, mu: 1.05 },
  body: {
    style: 'roadster',
    tail: 'engine-deck',
    bonnetHMm: 780,
    beltHMm: 880,
    cowlXMm: -550,
    roofFrontXMm: -1100,
    roofRearXMm: -1750,
    tailHMm: 1000,
    paint: '#24a6c9',
  },
  bay: { widthMm: 1250, lengthMm: 750 },
  powertrain: {
    kind: 'ice',
    engine: 'flat4-718',
    // The 911's boxer idea, but ahead of the rear axle and turned round: gearbox behind.
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -2075,
    crankYMm: 400,
    gearbox: 'mid-transaxle',
    gearboxKg: 75,
    driven: 'rear',
    fuelTank: { litres: 54, xMm: 150 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'macpherson' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 150, rear: 125 },
  bodyCgFrac: 0.51,
  blurb:
    'Same maker, engine moved ahead of the rear axle: the 911’s ingredients made mid-engined, with a fabric roof.',
  published: {
    curbKg: 1350,
    frontPct: 44,
    source:
      '718 Boxster T: 220 kW (300 PS) / 380 Nm 2.0 flat-4 turbo, 4379 × 1801 × 1281 mm, wheelbase 2475, track 1515/1532, 275 L boot (front + rear), 6-speed manual or 7-speed PDK — auto-motor-und-sport.de; kerb 1350 kg (manual), 235/35 R20 + 265/35 R20 — encycarpedia; ~ 54 L tank (Porsche standard; 64 L optional) and 150/125 L split of the boot estimated; ~ 44/56 split as quoted for the 718 GTS 4.0 (Autoblog), not found for the T',
  },
};

export default v;
