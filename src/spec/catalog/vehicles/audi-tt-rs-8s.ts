import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-tt-rs-8s',
  name: 'Audi TT RS Coupé (8S)',
  archetype: 'sports',
  examples: ['Audi RS3 (8V / 8Y)', 'Audi TT RS (8J)', 'Cupra Formentor VZ5'],
  years: '2016–2023',
  dims: {
    wheelbaseMm: 2505,
    trackFMm: 1564,
    trackRMm: 1543,
    lengthMm: 4201,
    widthMm: 1832,
    heightMm: 1344,
    overhangFMm: 900,
  },
  // 245/35 R19
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 654, mu: 1.05 },
  body: {
    style: 'coupe',
    tail: 'hatch',
    bonnetHMm: 880,
    beltHMm: 950,
    cowlXMm: -330,
    roofFrontXMm: -1150,
    roofRearXMm: -2100,
    tailHMm: 1000,
    paint: '#34513a',
  },
  bay: { widthMm: 1150, lengthMm: 750 },
  powertrain: {
    kind: 'ice',
    engine: 'i5',
    // Five cylinders across an MQB nose: the long block and the gearbox span the bay.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 200,
    crankYMm: 430,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 85,
    driven: 'all',
    // Haldex: front drive until a wet clutch ahead of the rear diff closes.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.85,
    fuelTank: { litres: 55, xMm: -1950 },
  },
  // Audi Space Frame hybrid: aluminium and steel.
  chassis: 'spaceframe',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 305 },
  bodyCgFrac: 0.45,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1200, 300, 0],
      sizeMm: [2050, 80, 80],
    },
  ],
  blurb:
    'A five-cylinder across the nose of a Golf-platform coupé, with a Haldex clutch bringing in the rear axle.',
  published: {
    curbKg: 1475,
    frontPct: 61,
    source:
      'Audi technical data, TT RS Coupé (11/2022): 4201 × 1832 × 1344 mm, wb 2505, tracks 1564/1543, 1475 kg without driver, 2480 cc 294 kW / 480 Nm, 7-speed S tronic, 245/35 R19, 55 L, McPherson / 4-link; 61.2/38.8 split — auto motor und sport test (06/2019); ~ overhang and engine position',
  },
};

export default v;
