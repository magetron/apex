import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mercedes-amg-gt-r-c190',
  name: 'Mercedes-AMG GT R (C190)',
  archetype: 'gt',
  examples: [
    'Chevrolet Corvette C7 (front-mid V8 + rear transaxle)',
    'Porsche 928',
    'Ferrari 812 Superfast',
  ],
  dims: {
    wheelbaseMm: 2630,
    trackFMm: 1693,
    trackRMm: 1683,
    lengthMm: 4551,
    widthMm: 2007,
    heightMm: 1284,
    overhangFMm: 895,
  },
  // 285/30 R19 front, 335/25 R20 rear
  tires: { widthFMm: 285, widthRMm: 335, diameterMm: 654, mu: 1.1 },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 900,
    beltHMm: 950,
    cowlXMm: -1100,
    roofFrontXMm: -1550,
    roofRearXMm: -2300,
    tailHMm: 1000,
    paint: '#f1c40f',
  },
  bay: { widthMm: 1300, lengthMm: 1200 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-m178-gt-r',
    // The whole V8 sits behind the front axle and low, thanks to the dry sump.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -420,
    crankYMm: 370,
    // 7-speed dual-clutch at the rear axle, joined to the engine by a torque tube.
    gearbox: 'rear-transaxle',
    gearboxKg: 110,
    driven: 'rear',
    fuelTank: { litres: 75, xMm: -1950 },
  },
  // Aluminium space frame (231 kg body-in-white).
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 350 },
  // Long bonnet, cabin set back against the rear axle.
  bodyCgFrac: 0.54,
  extraMasses: [
    {
      id: 'torque-tube',
      label: 'Torque tube + carbon prop shaft',
      kg: 25,
      posMm: [-1500, 360, 0],
      sizeMm: [1900, 120, 120],
    },
  ],
  blurb: 'A front-mid V8 with the gearbox moved to the rear axle, joined to it by a torque tube.',
  published: {
    curbKg: 1555,
    frontPct: 47,
    source:
      'AMG GT R: 430 kW (585 PS) / 700 Nm, 4551 × 2007 × 1284 mm, wheelbase 2630, track 1693/1683, 285/30 R19 + 335/25 R20 (test car, Cup 2), 350 L, 7-speed dual-clutch, rear drive — auto-motor-und-sport.de Supertest data (03/2017); ~ kerb 1555 kg DIN, the 1630 kg EU figure (encycarpedia) less the 75 kg driver; 47:53 split and transaxle/torque-tube layout — Mercedes-AMG press text (via Manorama); ~ front overhang measured on the model',
  },
};

export default v;
