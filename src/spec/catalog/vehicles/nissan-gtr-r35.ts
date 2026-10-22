import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'nissan-gtr-r35',
  name: 'Nissan GT-R (R35)',
  archetype: 'sports',
  examples: [
    'Nissan GT-R NISMO',
    'Ferrari FF / Purosangue (different AWD, same idea of a front-engine supercar)',
  ],
  dims: {
    wheelbaseMm: 2780,
    trackFMm: 1590,
    trackRMm: 1600,
    lengthMm: 4710,
    widthMm: 1895,
    heightMm: 1370,
    overhangFMm: 980,
  },
  // 255/40 ZRF20 front, 285/35 ZRF20 rear
  // μ (lateral peak) 1.12, set so the sim's 100–0 km/h stop matches: 100–0 km/h 33 m — fastestlaps
  // (magazine not shown)
  // ~ kind: OE Dunlop SP Sport Maxx GT600 run-flat
  tires: { widthFMm: 255, widthRMm: 285, diameterMm: 712, mu: 1.12, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    // High, bulging bonnet over the tall V6 with its turbos and intake.
    bonnetHMm: 960,
    beltHMm: 980,
    cowlXMm: -650,
    roofFrontXMm: -1350,
    roofRearXMm: -2350,
    tailHMm: 1050,
    paint: '#a9adb2',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-vr38',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -200,
    crankYMm: 470,
    // GR6 dual-clutch transaxle with the transfer clutch at the rear; a prop shaft runs back to
    // it and a second one runs forward again to the front differential.
    gearbox: 'rear-transaxle',
    gearboxKg: 140,
    driven: 'all',
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.2,
    // ATTESA E-TS: the transfer clutch varies the split from 0:100 to 50:50 front:rear (Nissan's
    // quoted range), never more to the front
    awdDevice: { type: 'clutch', name: 'ATTESA E-TS', frontRange: [0, 0.5] },
    fuelTank: { litres: 74, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 315 },
  bodyCgFrac: 0.49,
  blurb:
    'Front engine, gearbox at the rear axle, and a second prop shaft running forward to the front wheels.',
  published: {
    curbKg: 1752,
    frontPct: 54,
    source:
      'Kerb 1752 kg (MY2017; range 1703–1752) — auto-data.net; ~ 54/46 split as commonly quoted from press tests (a GT3 build article starts from ~56 % front); ~ dims from Nissan data, not re-checked',
  },
};

export default v;
