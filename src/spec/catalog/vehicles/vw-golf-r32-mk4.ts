import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-golf-r32-mk4',
  name: 'VW Golf R32 (Mk4)',
  archetype: 'hot-hatch',
  examples: ['Audi TT 3.2 quattro (8N)', 'Audi A3 3.2 quattro (8P)', 'VW Golf R32 (Mk5)'],
  years: '2002–2004',
  dims: {
    wheelbaseMm: 2518,
    trackFMm: 1513,
    trackRMm: 1487,
    lengthMm: 4149,
    widthMm: 1735,
    heightMm: 1444,
    overhangFMm: 880,
  },
  // 225/40 ZR18
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 637, mu: 1.0 },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 930,
    beltHMm: 990,
    cowlXMm: -250,
    roofFrontXMm: -1000,
    roofRearXMm: -2800,
    tailHMm: 1000,
    paint: '#1c2c5e',
  },
  bay: { widthMm: 1100, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'vr6',
    // The narrow VR6 is short enough to sit across the car where a Golf normally has a four.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 140,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    // six-speed manual
    gearboxKg: 70,
    driven: 'all',
    // First-generation Haldex: front drive, a clutch pack ahead of the rear diff adds rear drive.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.9,
    fuelTank: { litres: 62, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'double-wishbone' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 330 },
  bodyCgFrac: 0.45,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1250, 300, 0],
      sizeMm: [2100, 80, 80],
    },
  ],
  blurb:
    'A six-cylinder squeezed across a Golf’s nose, with a Haldex clutch that wakes up the rear axle on demand.',
  published: {
    curbKg: 1477,
    frontPct: 61,
    source:
      'Kerb 1477 kg, manual (evo road test, encycarpedia; 1521 kg DSG); wheelbase 2518 mm, 4149 × 1735 × 1444 mm, tracks 1513/1487 mm, 225/40 ZR18, 62 L tank — cars-data.com; 3.2 VR6 177 kW (241 PS) / 320 Nm, Haldex default ~90:10 — australiancar.reviews; ~ overhang; ~ 61/39 split estimated',
  },
};

export default v;
