import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'suzuki-swift-a2l',
  name: 'Suzuki Swift 1.2 (A2L)',
  archetype: 'city',
  examples: ['Suzuki Baleno (same HEARTECT platform)', 'Toyota Yaris (XP150)', 'Hyundai i20'],
  dims: {
    wheelbaseMm: 2450,
    trackFMm: 1530,
    trackRMm: 1520,
    lengthMm: 3845,
    widthMm: 1735,
    heightMm: 1495,
    overhangFMm: 795,
  },
  // 185/55 R16
  tires: { widthFMm: 185, widthRMm: 185, diameterMm: 610, mu: 0.95 },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 990,
    beltHMm: 1060,
    cowlXMm: -260,
    roofFrontXMm: -950,
    roofRearXMm: -2500,
    tailHMm: 1200,
    paint: '#b9bcc0',
  },
  bay: { widthMm: 1050, lengthMm: 580 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-k12m',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 380,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 45,
    driven: 'front',
    fuelTank: { litres: 37, xMm: -1900 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 265 },
  bodyCgFrac: 0.43,
  blurb:
    'A light platform around a small four: under 900 kg, with most of it on the driven front wheels.',
  published: {
    curbKg: 900,
    frontPct: 62,
    source:
      'Wb 2450, 3845 × 1735 × 1495 mm, tracks 1530/1520, kerb 870–900 kg (manual/CVT), 37 L tank — Suzuki NZ via carexpert.co.nz (2021 Swift 1.2); curb 840–1000 kg FWD range — Wikipedia "Suzuki Swift"; 185/55 R16 (GLX); ~ 62/38 split estimated (small FF; no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;
