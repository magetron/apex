import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-golf-gti-mk8',
  name: 'VW Golf GTI (Mk8)',
  archetype: 'hot-hatch',
  examples: ['Honda Civic Type R', 'Hyundai i30 N', 'Peugeot 308 GTi'],
  dims: {
    wheelbaseMm: 2636,
    trackFMm: 1543,
    trackRMm: 1516,
    lengthMm: 4287,
    widthMm: 1789,
    heightMm: 1463,
    overhangFMm: 880,
  },
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 637, mu: 1.0 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 1000,
    cowlXMm: -170,
    roofFrontXMm: -1000,
    roofRearXMm: -2550,
    tailHMm: 1150,
    paint: '#c8102e',
  },
  bay: { widthMm: 1080, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 180,
    crankYMm: 420,
    engineTiltDeg: 12,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 80,
    driven: 'front',
    fuelTank: { litres: 50, xMm: -2050 },
  },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 380 },
  bodyCgFrac: 0.455,
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  blurb:
    'The hot hatch: front drive plus a locking differential, working against traction and torque-steer limits.',
  published: {
    curbKg: 1430,
    frontPct: 61,
    source:
      'Wheelbase 2636 mm, 180 kW / 370 Nm — VW via Wikipedia "Volkswagen Golf Mk8"; ~ kerb 1430 kg (US curb 3113–3190 lb = 1412–1447 kg); ~ 61/39 split (US spec databases list 62/38); ~ tracks',
  },
};

export default v;
