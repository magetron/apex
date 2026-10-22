import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mazda-3-bp',
  name: 'Mazda3 2.0 hatchback (BP)',
  archetype: 'hatch',
  examples: ['VW Golf (Mk8)', 'Toyota Corolla hatchback', 'Mazda CX-30 (same platform)'],
  dims: {
    wheelbaseMm: 2725,
    trackFMm: 1570,
    trackRMm: 1580,
    lengthMm: 4460,
    widthMm: 1795,
    heightMm: 1440,
    overhangFMm: 900,
  },
  // 215/45 R18
  tires: { widthFMm: 215, widthRMm: 215, diameterMm: 651, mu: 0.95 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 910,
    beltHMm: 1000,
    cowlXMm: -450,
    roofFrontXMm: -1250,
    roofRearXMm: -2350,
    tailHMm: 1140,
    paint: '#9b111e',
  },
  bay: { widthMm: 1100, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-pe-vps',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 170,
    crankYMm: 410,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 60,
    driven: 'front',
    fuelTank: { litres: 51, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 358 },
  bodyCgFrac: 0.44,
  blurb:
    'A family hatch drawn like a coupé: the long bonnet is styling, the drivetrain underneath is the usual transverse front-drive pack.',
  published: {
    curbKg: 1317,
    frontPct: 61,
    source:
      'Wb 2725, tracks 1570/1580, 4460 × 1795 × 1440 mm, 51 L tank — cars-data.com (Mazda3 BP hatchback 2.0); kerb 1317 kg (G20 Pure manual hatch, 114 kW / 200 Nm) — Mazda Australia via carexpert.com.au; 215/45 R18 on upper trims; ~ 61/39 split estimated (no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;
