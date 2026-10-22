import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-rs6-avant-gt-c8',
  name: 'Audi RS 6 Avant GT (C8)',
  archetype: 'saloon',
  examples: [
    'Audi RS 6 Avant (C8)',
    'Audi RS 4 Avant (B9, same layout with a V6)',
    'Every longitudinal-engine Audi (A4–A8, quattro)',
  ],
  years: '2024',
  dims: {
    wheelbaseMm: 2929,
    trackFMm: 1668,
    trackRMm: 1650,
    lengthMm: 4995,
    widthMm: 1951,
    heightMm: 1450,
    overhangFMm: 955,
  },
  // 285/30 R22
  // ~ μ (lateral peak) 1.1, set so the sim's 100–0 km/h stop matches: ~34 m from 100 km/h: 2 m
  // behind the RS 6 performance (32.0 m cold) — Auto Bild Supertest
  // kind: Conti SportContact 7 285/30 R22 (Auto Bild)
  tires: { widthFMm: 285, widthRMm: 285, diameterMm: 730, mu: 1.1, kind: 'performance' },
  body: {
    style: 'estate',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 1000,
    cowlXMm: -520,
    roofFrontXMm: -1350,
    roofRearXMm: -3250,
    tailHMm: 1120,
    paint: '#8e9294',
  },
  bay: { widthMm: 1300, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ea825-gt',
    // Audi's longitudinal layout: the whole V8 hangs ahead of the front axle, the front
    // differential sits between engine and gearbox.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 260,
    crankYMm: 465,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Permanent quattro with a purely mechanical (Torsen-type) centre differential, 40:60; the GT
    // gets a lighter one.
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    awdDevice: { type: 'torque-sensing', frontRange: [0.15, 0.7] },
    fuelTank: { litres: 73, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 548 },
  bodyCgFrac: 0.5,
  blurb:
    'Audi’s longitudinal layout: the engine hangs ahead of the front axle, so the nose carries more weight.',
  published: {
    curbKg: 2075,
    frontPct: 57.5,
    source:
      'RS 6 Avant GT (2024, 660 built): 463 kW (630 PS) / 850 Nm, 4995 × 1951 × 1450 mm, wheelbase 2929, 285/30 R22, 73 L, 548 L, 2165 kg EU — ADAC Autokatalog; kerb 2075 kg without driver — Audi technical data via encycarpedia; coilovers, 10 mm lower, lighter centre differential — auto-zeitung.de; ~ tracks 1668/1650 as the RS 6 Avant performance (meinauto.de); 40:60 centre-diff split, up to 70 % front or 85 % rear — Audi MediaCenter (RS 6 C8); ~ 57.5/42.5 split estimated as the RS 6',
  },
};

export default v;
