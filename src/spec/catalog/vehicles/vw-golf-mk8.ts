import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-golf-mk8',
  name: 'VW Golf 1.5 TSI (Mk8)',
  archetype: 'hatch',
  examples: ['Ford Focus', 'Toyota Corolla', 'Skoda Octavia (same MQB platform)'],
  dims: {
    wheelbaseMm: 2636,
    trackFMm: 1549,
    trackRMm: 1520,
    lengthMm: 4284,
    widthMm: 1789,
    heightMm: 1456,
    overhangFMm: 880,
  },
  // 205/55 R16
  tires: { widthFMm: 205, widthRMm: 205, diameterMm: 632, mu: 0.95 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 1000,
    cowlXMm: -170,
    roofFrontXMm: -1000,
    roofRearXMm: -2550,
    tailHMm: 1150,
    paint: '#cdd44c',
  },
  bay: { widthMm: 1080, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-ea211',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 170,
    crankYMm: 410,
    // EA211 is installed tilted back 12° with the exhaust toward the bulkhead.
    engineTiltDeg: 12,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 55,
    driven: 'front',
    fuelTank: { litres: 50, xMm: -2050 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 381 },
  bodyCgFrac: 0.45,
  blurb:
    'The default layout of the world: transverse four-cylinder and gearbox in the nose, front-wheel drive.',
  published: {
    curbKg: 1290,
    frontPct: 60,
    source:
      'Dims 2636 wb / 4284 × 1789 × 1456 mm — VW via Wikipedia "Volkswagen Golf Mk8"; ~ kerb (Mk8 range 1255–1465 kg) and ~ 60/40 split estimated as GTI less ~40 kg of engine; ~ tracks',
  },
};

export default v;
