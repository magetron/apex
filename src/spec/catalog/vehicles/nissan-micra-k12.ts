import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'nissan-micra-k12',
  name: 'Nissan Micra 1.2 (K12)',
  archetype: 'city',
  examples: ['Renault Clio III (same B platform)', 'Toyota Yaris (XP10)', 'Honda Jazz (GD)'],
  years: '2002–2010',
  dims: {
    wheelbaseMm: 2430,
    trackFMm: 1470,
    trackRMm: 1445,
    lengthMm: 3715,
    widthMm: 1660,
    heightMm: 1540,
    overhangFMm: 695,
  },
  // 175/60 R15
  // ~ μ (lateral peak) 0.95, set so the sim's 100–0 km/h stop matches: ~38 m from 100 km/h: the K13
  // 1.2 (35.2 m, Auto Zeitung 2011) on older, narrower tyres
  // ~ kind: OE touring
  tires: { widthFMm: 175, widthRMm: 175, diameterMm: 591, mu: 0.95, kind: 'road' },
  body: {
    style: 'city',
    tail: 'hatch',
    bonnetHMm: 905,
    beltHMm: 1000,
    cowlXMm: -260,
    roofFrontXMm: -1050,
    roofRearXMm: -2500,
    tailHMm: 1080,
    paint: '#98a3c9',
  },
  bay: { widthMm: 1000, lengthMm: 560 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-cr12de',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 200,
    crankYMm: 390,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 40,
    driven: 'front',
    fuelTank: { litres: 46, xMm: -1900 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 251 },
  bodyCgFrac: 0.42,
  blurb:
    'The modern small-car recipe: a short four and its gearbox side by side ahead of the front wheels, leaving the rest of the length for people.',
  published: {
    curbKg: 946,
    frontPct: 63,
    source:
      'Wb 2430 (ADAC 2432), tracks 1470/1445, 3715 × 1660 × 1525–1540 mm, 46 L tank — auto-data.net and ADAC Autokatalog (Micra 1.2 K12); kerb 946 kg = ADAC EU 1021 kg less the 75 kg driver; 175/60 R15 (ADAC, 1.2 Acenta); ~ 63/37 split estimated (small FF; no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;
