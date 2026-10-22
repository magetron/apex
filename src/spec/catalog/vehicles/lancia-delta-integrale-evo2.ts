import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'lancia-delta-integrale-evo2',
  name: 'Lancia Delta HF Integrale Evoluzione II',
  archetype: 'hot-hatch',
  examples: [
    'Lancia Delta HF 4WD / Integrale (1986–1994)',
    'Toyota GR Yaris',
    'Ford Escort RS Cosworth (longitudinal rival)',
  ],
  years: '1993–1994',
  dims: {
    wheelbaseMm: 2480,
    trackFMm: 1517,
    trackRMm: 1506,
    lengthMm: 3900,
    widthMm: 1770,
    heightMm: 1365,
    overhangFMm: 780,
  },
  // 205/45 ZR16 on 7.5 × 16
  tires: { widthFMm: 205, widthRMm: 205, diameterMm: 591, mu: 0.95 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 880,
    beltHMm: 950,
    cowlXMm: -380,
    roofFrontXMm: -950,
    roofRearXMm: -2450,
    tailHMm: 1000,
    paint: '#b3161b',
  },
  bay: { widthMm: 1150, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-lancia-831',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 150,
    crankYMm: 420,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 75,
    driven: 'all',
    // Epicyclic centre diff (47:53) with a Ferguson viscous coupling; Torsen rear diff.
    awd: 'center-diff',
    frontTorqueShare: 0.47,
    awdDevice: { type: 'viscous' },
    fuelTank: { litres: 57, xMm: -2150 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'macpherson' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 230 },
  bodyCgFrac: 0.47,
  extraMasses: [
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1250, 300, 0],
      sizeMm: [2100, 80, 80],
    },
  ],
  blurb:
    'A transverse turbo four with permanent four-wheel drive: a centre differential sends a little more torque to the rear.',
  published: {
    curbKg: 1340,
    frontPct: 60,
    source:
      'Kerb 1340 kg, 2480 wb, 3900 × 1770 × 1365 mm, tracks 1517/1506 mm, 57 L tank — carsales.com.au (Evo II); 205/45 ZR16, 47/53 epicyclic centre diff + viscous coupling + Torsen rear — Wikipedia "Lancia Delta"; ~ overhang; ~ 60/40 split estimated (no published axle loads found)',
  },
};

export default v;
