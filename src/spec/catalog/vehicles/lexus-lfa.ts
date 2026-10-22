import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'lexus-lfa',
  name: 'Lexus LFA',
  archetype: 'gt',
  examples: [
    'Ferrari Roma / 812 (front-mid engine, rear transaxle)',
    'Mercedes-AMG GT (C190)',
    'Aston Martin One-77',
  ],
  dims: {
    wheelbaseMm: 2605,
    trackFMm: 1580,
    trackRMm: 1570,
    lengthMm: 4505,
    widthMm: 1895,
    heightMm: 1220,
    // ~ measured on the model (no published figure)
    overhangFMm: 913,
  },
  // 265/35 ZR20 front, 305/30 ZR20 rear
  // μ (lateral peak) 1.15, set so the sim's 100–0 km/h stop matches: 100–0 km/h 31.6 m warm — sport
  // auto braking ranking, Jan 2020
  // kind: Bridgestone Potenza RE070 (sport auto)
  tires: { widthFMm: 265, widthRMm: 305, diameterMm: 692, mu: 1.15, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 860,
    beltHMm: 900,
    cowlXMm: -820,
    roofFrontXMm: -1300,
    roofRearXMm: -2300,
    tailHMm: 960,
    paint: '#f2f2f0',
  },
  bay: { widthMm: 1200, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v10-1lr-gue',
    // The compact V10 sits entirely behind the front axle, low on its dry sump.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -400,
    crankYMm: 360,
    // 6-speed automated manual (ASG) in a transaxle at the rear axle, joined by a torque tube.
    gearbox: 'rear-transaxle',
    gearboxKg: 90,
    driven: 'rear',
    fuelTank: { litres: 73, xMm: -2100 },
  },
  chassis: 'carbon-tub',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 126 },
  bodyCgFrac: 0.5,
  blurb:
    'A V10 behind the front axle and the gearbox at the rear: the weight sits between the wheels.',
  published: {
    curbKg: 1480,
    frontPct: 48,
    source:
      'Dims 4505 × 1895 × 1220 mm, wheelbase 2605, tracks 1580/1570, 1480 kg "vehicle weight" (Wikipedia gives 1580 kg kerb), 265/35 ZR20 + 305/30 ZR20, 6-speed ASG rear transaxle — Toyota LFA main specifications (European market, 2009); ~ 48/52 split as quoted from Lexus launch material, not in the spec sheet; ~ 73 L tank, luggage and engine position estimated',
  },
};

export default v;
