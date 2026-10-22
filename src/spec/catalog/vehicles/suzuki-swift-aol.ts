import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'suzuki-swift-aol',
  name: 'Suzuki Swift 1.2 Hybrid (AOL)',
  archetype: 'city',
  examples: [
    'Toyota Yaris (XP210)',
    'Renault Clio V',
    'Suzuki Swift (A2L, previous body on the same platform)',
  ],
  dims: {
    wheelbaseMm: 2450,
    trackFMm: 1520,
    trackRMm: 1520,
    lengthMm: 3860,
    widthMm: 1735,
    heightMm: 1495,
    overhangFMm: 800,
  },
  // 185/55 R16
  tires: { widthFMm: 185, widthRMm: 185, diameterMm: 610, mu: 0.95 },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 970,
    beltHMm: 1050,
    cowlXMm: -250,
    roofFrontXMm: -950,
    roofRearXMm: -2450,
    tailHMm: 1150,
    paint: '#d6d8da',
  },
  bay: { widthMm: 1050, lengthMm: 580 },
  powertrain: {
    kind: 'ice',
    engine: 'i3-z12e',
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
  bodyCgFrac: 0.425,
  blurb:
    'The same short-nose package with a three-cylinder in place of the four: one cylinder shorter across the car.',
  published: {
    curbKg: 949,
    frontPct: 62,
    source:
      'Wb 2450, 3860 × 1735 × 1485–1520 mm, 12 V mild hybrid (2.3 kW WA06D starter-generator) — Wikipedia "Suzuki Swift"; the starter-generator is modelled as a plain ICE; tracks 1520/1520, 185/55 R16 — carsales.com.au (2024 Swift Hybrid GLX); kerb 949 kg (EU Hybrid, encycarpedia; AU Hybrid GLX CVT 934–957 kg); 37 L tank; ~ 62/38 split estimated (small FF; no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;
