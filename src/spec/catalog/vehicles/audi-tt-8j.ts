import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-tt-8j',
  name: 'Audi TT Coupé 3.2 quattro (8J)',
  archetype: 'sports',
  examples: ['VW Golf R32 (Mk5)', 'Audi A3 3.2 quattro (8P)', 'Audi TTS / TT RS (8J)'],
  years: '2006–2010',
  dims: {
    wheelbaseMm: 2468,
    trackFMm: 1572,
    trackRMm: 1558,
    lengthMm: 4178,
    widthMm: 1842,
    heightMm: 1352,
    overhangFMm: 905,
  },
  // 245/45 R17
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 652, mu: 1.0 },
  body: {
    style: 'coupe',
    tail: 'hatch',
    bonnetHMm: 900,
    beltHMm: 945,
    cowlXMm: -350,
    roofFrontXMm: -900,
    roofRearXMm: -1900,
    tailHMm: 950,
    paint: '#c9cbcd',
  },
  bay: { widthMm: 1150, lengthMm: 750 },
  powertrain: {
    kind: 'ice',
    engine: 'vr6',
    // The narrow VR6 is what lets a six fit across the nose of a Golf-platform car.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 200,
    crankYMm: 430,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 90,
    driven: 'all',
    // Haldex: front drive until a wet clutch ahead of the rear diff closes.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.9,
    fuelTank: { litres: 60, xMm: -1950 },
  },
  // Audi Space Frame hybrid: aluminium front structure, steel rear.
  chassis: 'spaceframe',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 290 },
  bodyCgFrac: 0.47,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1200, 300, 0],
      sizeMm: [2050, 80, 80],
    },
    // The V6 car carries its battery in the boot to offset the heavier engine.
    { id: 'battery', label: '12 V battery (boot)', kg: 20, posMm: [-2850, 350, 350] },
  ],
  blurb:
    'A Golf-platform coupé with a six across the nose: the narrow VR6 fits, and a Haldex clutch brings in the rear axle.',
  published: {
    curbKg: 1410,
    frontPct: 59,
    source:
      'Dims 4178 × 1842 × 1352 mm, wb 2468, tracks 1572/1558, 184 kW / 320 Nm, 60 L, 245/45 R17 — ADAC Autokatalog and encycarpedia; kerb 1485 kg EU incl. 75 kg driver (ADAC) → ~ 1410 kg; 59.4/40.6 weight split — Car and Driver test (via German Car Forum); ~ front overhang 905 mm measured on the 3D model; ~ battery in the boot and engine position estimated',
  },
};

export default v;
