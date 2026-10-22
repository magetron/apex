import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-r8-v10-gt-rwd',
  name: 'Audi R8 Coupé V10 GT RWD',
  archetype: 'supercar',
  examples: ['Audi R8 V10 performance RWD', 'Lamborghini Huracán EVO RWD (shared platform)'],
  years: '2023',
  dims: {
    wheelbaseMm: 2650,
    trackFMm: 1645,
    trackRMm: 1599,
    lengthMm: 4429,
    widthMm: 1940,
    heightMm: 1236,
    overhangFMm: 995,
  },
  // 245/30 R20 front, 305/30 R20 rear
  tires: { widthFMm: 245, widthRMm: 305, diameterMm: 655, mu: 1.15 },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 760,
    beltHMm: 850,
    cowlXMm: -300,
    roofFrontXMm: -950,
    roofRearXMm: -1650,
    tailHMm: 1050,
    paint: '#5d8f4e',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v10',
    // The quattro car's layout minus the prop shaft and front differential.
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -2050,
    crankYMm: 360,
    gearbox: 'mid-transaxle',
    gearboxKg: 140,
    driven: 'rear',
    fuelTank: { litres: 83, xMm: -250 },
  },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 112 },
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  bodyCgFrac: 0.555,
  blurb: 'The same mid-engined V10, with nothing driving the front wheels.',
  published: {
    curbKg: 1570,
    frontPct: 40,
    source:
      'GT RWD: 456 kW (620 PS) / 565 Nm, 7-speed S tronic, 1570 kg (20 kg under the performance RWD), 245/30 / 305/30 R20 — Audi press release (Oct 2022) via carindia.in, autorai.nl and encycarpedia; body 4429 × 1940 × 1236 mm, wb 2650, tracks 1645/1599, 83 L — Audi technical data, R8 V10 Coupé RWD (2020); 40:60 axle split — Audi MediaCenter, R8 V10 performance RWD; ~ engine position as the quattro car; ~ front overhang as the quattro car (the GT model’s aero adds ~40 mm at each end)',
  },
};

export default v;
