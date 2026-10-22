import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'abarth-500-312',
  name: 'Abarth 500 1.4 T-Jet (312)',
  archetype: 'hot-hatch',
  examples: ['Fiat 500 (2007, the car it is built on)', 'Mini Cooper S (R56)', 'VW up! GTI'],
  dims: {
    wheelbaseMm: 2300,
    trackFMm: 1409,
    trackRMm: 1402,
    lengthMm: 3657,
    widthMm: 1627,
    heightMm: 1485,
    overhangFMm: 775,
  },
  // 205/40 R17 (the 17-inch option the model wears; 195/45 R16 standard)
  tires: { widthFMm: 205, widthRMm: 205, diameterMm: 596, mu: 1.0 },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 880,
    beltHMm: 960,
    cowlXMm: -250,
    roofFrontXMm: -1000,
    roofRearXMm: -2450,
    tailHMm: 1180,
    paint: '#efe8d6',
  },
  bay: { widthMm: 1000, lengthMm: 560 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-tjet',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 380,
    engineTiltDeg: -10,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 45,
    driven: 'front',
    fuelTank: { litres: 35, xMm: -1950 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 185 },
  bodyCgFrac: 0.45,
  blurb:
    'Same name, opposite layout: a transverse turbo four driving the front wheels, like almost every modern small car.',
  published: {
    curbKg: 1035,
    frontPct: 62,
    source:
      'Abarth 500 1.4 T-Jet 135 PS (2008–2014): 3657 × 1627 × 1485 mm, wheelbase 2300, track 1409/1402, kerb 1035 kg, 195/45 R16, 35 L, 185 L, 5-speed manual, MacPherson front / twist beam rear — auto-data.net; ~ 205/40 R17 option estimated from the model’s wheels; ~ front overhang measured on the model (the Abarth nose is longer than the Fiat’s); ~ 62/38 split estimated (as the Fiat 500; no published figure found)',
  },
};

export default v;
