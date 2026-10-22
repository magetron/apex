import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-750li-g12',
  name: 'BMW 750Li xDrive (G12)',
  archetype: 'luxury',
  examples: ['BMW 7 Series (all xDrive)', 'BMW X5 (G05)', 'BMW M5 (F90)'],
  dims: {
    wheelbaseMm: 3210,
    trackFMm: 1621,
    trackRMm: 1650,
    lengthMm: 5260,
    widthMm: 1902,
    heightMm: 1479,
    overhangFMm: 880,
  },
  // 245/45 R19 all round
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 703, mu: 0.95 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 1000,
    beltHMm: 1060,
    cowlXMm: -650,
    roofFrontXMm: -1500,
    roofRearXMm: -3250,
    tailHMm: 1110,
    paint: '#1d2430',
  },
  bay: { widthMm: 1300, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-n63',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -230,
    crankYMm: 470,
    gearbox: 'inline',
    gearboxKg: 90,
    driven: 'all',
    // xDrive: an RWD car whose transfer-case clutch feeds the front axle; nominal 40:60.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 78, xMm: -2700 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 515 },
  bodyCgFrac: 0.52,
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 25, posMm: [-3800, 400, 300] },
  ],
  blurb:
    'A long-wheelbase limousine on a rear-drive layout: the V8 sits behind the front axle and xDrive adds a front axle on demand.',
  published: {
    curbKg: 2075,
    frontPct: 52.5,
    source:
      'Kerb 2075 kg DIN, 5260 × 1902 × 1479 mm, wheelbase 3210 mm, tracks 1621/1650 mm, 245/45 R19, 78 L — auto-data.net / autotijd.be (750Li xDrive LCI, 2019–22); ~ 52.5/47.5 split: BMW lists 52.3 % front (F02 750Li xDrive, US MY2015 spec sheet) and ~52.8 % (G12 Canada press kit)',
  },
};

export default v;
