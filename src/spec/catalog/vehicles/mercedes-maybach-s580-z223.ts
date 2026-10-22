import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mercedes-maybach-s580-z223',
  name: 'Mercedes-Maybach S 580 4MATIC (Z223)',
  archetype: 'luxury',
  examples: ['Mercedes-Benz S 580 4MATIC (W223, long)', 'BMW 7 Series (G70)', 'Audi A8 L (D5)'],
  years: '2021–',
  dims: {
    wheelbaseMm: 3396,
    trackFMm: 1655,
    trackRMm: 1683,
    lengthMm: 5469,
    widthMm: 1921,
    heightMm: 1510,
    overhangFMm: 900,
  },
  // 255/45 R19
  tires: { widthFMm: 255, widthRMm: 255, diameterMm: 712, mu: 0.95 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 1000,
    beltHMm: 1060,
    cowlXMm: -600,
    roofFrontXMm: -1450,
    roofRearXMm: -3330,
    tailHMm: 1100,
    paint: '#1b1c1f',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-m176',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -300,
    crankYMm: 490,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Permanent 4MATIC: centre differential, 45:55 front:rear.
    awd: 'center-diff',
    frontTorqueShare: 0.45,
    fuelTank: { litres: 76, xMm: -3130 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 500 },
  bodyCgFrac: 0.52,
  blurb:
    'Refinement and space first: an extra-long-wheelbase saloon with a V8 and permanent all-wheel drive.',
  published: {
    curbKg: 2380,
    frontPct: 52,
    source:
      'Maybach S 580 (Z223): wb 3396 (180 mm longer than the S-Class long), 5469 × 1921 × 1510 mm, tracks 1655/1683, 255/45 R19, 76 L — Mercedes-Benz technical data (2026 sheet) and ADAC Autokatalog (pre-facelift length); curb 5247 lb (2380 kg) — MBUSA 2021 release; 370 kW / 700 Nm V8, its 48 V starter-generator modelled as a plain ICE; 45:55 4MATIC split — Wikipedia "Mercedes-Benz S-Class (W223)"; ~ 52/48 split estimated',
  },
};

export default v;
