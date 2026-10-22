import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-new-beetle-9c',
  name: 'VW New Beetle 2.0 (9C)',
  archetype: 'hatch',
  examples: ['VW Golf Mk4', 'Audi A3 (8L)', 'Škoda Octavia (1U)'],
  years: '1997–2010',
  dims: {
    wheelbaseMm: 2508,
    trackFMm: 1508,
    trackRMm: 1494,
    lengthMm: 4081,
    widthMm: 1724,
    heightMm: 1498,
    overhangFMm: 820,
  },
  // 205/55 R16
  tires: { widthFMm: 205, widthRMm: 205, diameterMm: 632, mu: 0.9 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 900,
    beltHMm: 1000,
    cowlXMm: -80,
    roofFrontXMm: -800,
    roofRearXMm: -2100,
    tailHMm: 950,
    paint: '#f2c400',
  },
  bay: { widthMm: 1100, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-ea827',
    // Golf Mk4 underneath: engine across the car ahead of the front axle — the opposite end
    // of the car from the original Beetle's air-cooled flat-four.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 160,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 50,
    driven: 'front',
    fuelTank: { litres: 55, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 340 },
  bodyCgFrac: 0.45,
  blurb: 'The old Beetle’s silhouette over a Golf’s front-engined, front-drive floorpan.',
  published: {
    curbKg: 1197,
    frontPct: 62,
    source:
      '2.0 Highline (1998): kerb 1197 kg, wheelbase 2508 mm, 4081 × 1724 × 1498 mm, tracks 1508/1494 mm, 205/55 R16, 55 L tank — cars-data.com (US cars 1230 kg); A4 (PQ34) platform, 2.0 8v 85 kW — Wikipedia "Volkswagen New Beetle"; ~ overhang; ~ 62/38 split estimated (as a Golf Mk4)',
  },
};

export default v;
