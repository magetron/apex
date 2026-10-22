import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-911-992',
  name: 'Porsche 911 Carrera S Cabriolet (992)',
  archetype: 'sports',
  examples: ['Porsche 911 (every generation since 1964)'],
  dims: {
    wheelbaseMm: 2450,
    trackFMm: 1589,
    trackRMm: 1557,
    lengthMm: 4519,
    widthMm: 1852,
    heightMm: 1299,
    // traced from a side-on photo: the rear-engined 911 has the longer REAR overhang
    overhangFMm: 940,
  },
  // μ (lateral peak) 1.08, set so the sim's lateral limit matches: skidpad 1.06 g, 300 ft — Car and
  // Driver, Jun 2020 (Carrera S manual)
  // kind: Pirelli P Zero (ADAC, C&D)
  tires: { widthFMm: 245, widthRMm: 305, diameterMm: 680, mu: 1.08, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 780,
    beltHMm: 900,
    cowlXMm: -600,
    roofFrontXMm: -1150,
    roofRearXMm: -1950,
    tailHMm: 960,
    paint: '#c9ccd1',
  },
  bay: { widthMm: 1300, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'flat6',
    position: 'rear-overhang',
    orientation: 'longitudinal',
    engineXMm: -2730,
    crankYMm: 380,
    gearbox: 'mid-transaxle',
    gearboxKg: 120,
    driven: 'rear',
    fuelTank: { litres: 64, xMm: 150 },
  },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { front: 132 },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  bodyCgFrac: 0.53,
  blurb:
    'The engine hangs behind the rear axle: superb traction, and a tail that can swing on lift-off.',
  published: {
    curbKg: 1585,
    frontPct: 38.5,
    source:
      'Carrera S Cabriolet (the model’s body): 4519 × 1852 × 1299 mm, wheelbase 2450, track 1589/1557 — auto-motor-und-sport.de (992 Carrera S Cabrio); ~ kerb 1585 kg DIN, the 1660 kg EU figure (same source) less the 75 kg driver; the coupé is 1515 kg DIN (PDK; 1590 kg EU, autotijd.be); ~ 38.5/61.5 split: 991 Carrera S PDK coupé weighed 38.3/61.7 (asphalte.ch) and 38.1/61.9 (Sport Auto), 992 owners report ~38/62',
  },
};

export default v;
