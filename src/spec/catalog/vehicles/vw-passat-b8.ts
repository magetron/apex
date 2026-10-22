import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-passat-b8',
  name: 'VW Passat 2.0 TSI (B8)',
  archetype: 'saloon',
  examples: ['Skoda Superb (B8)', 'VW Arteon', 'Ford Mondeo (Mk5)', 'Toyota Camry (XV70)'],
  dims: {
    wheelbaseMm: 2786,
    trackFMm: 1578,
    trackRMm: 1564,
    lengthMm: 4775,
    widthMm: 1832,
    heightMm: 1456,
    overhangFMm: 880,
  },
  // 235/45 R18
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 669, mu: 0.95 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 960,
    beltHMm: 1010,
    cowlXMm: -330,
    roofFrontXMm: -1150,
    roofRearXMm: -2700,
    tailHMm: 1080,
    paint: '#2c3e57',
  },
  bay: { widthMm: 1150, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i4',
    // MQB: the same transverse EA888 and end-on DSG as a Golf, in a bigger body.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 180,
    crankYMm: 430,
    engineTiltDeg: 12,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 90,
    driven: 'front',
    fuelTank: { litres: 66, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 586 },
  bodyCgFrac: 0.45,
  blurb:
    'The hot-hatch recipe stretched to a family saloon: everything that drives sits over the front wheels.',
  published: {
    curbKg: 1530,
    frontPct: 61,
    source:
      'Kerb 1530 kg DIN (2.0 TSI 190 PS DSG, 2019–22), wheelbase 2786 mm, tracks 1578/1564 mm, 4775 × 1832 mm — autotijd.be (VW data); 2791 mm/1584/1568 at the 2014 launch (Motor1); ~ height 1456 mm saloon (Wikipedia "Volkswagen Passat (B8)"); 66 L tank (VW); ~ 61/39 split estimated for a transverse-FF D-segment saloon',
  },
};

export default v;
