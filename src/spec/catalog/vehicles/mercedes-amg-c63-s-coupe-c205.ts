import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mercedes-amg-c63-s-coupe-c205',
  name: 'Mercedes-AMG C 63 S Coupé (C205)',
  archetype: 'sports',
  examples: ['Mercedes-AMG C 63 S (W205, the saloon)', 'BMW M4 (G82)', 'Lexus RC F'],
  dims: {
    wheelbaseMm: 2840,
    trackFMm: 1624,
    trackRMm: 1585,
    lengthMm: 4751,
    widthMm: 1877,
    heightMm: 1401,
    overhangFMm: 860,
  },
  // 255/35 R19 front, 285/30 R20 rear
  tires: { widthFMm: 255, widthRMm: 285, diameterMm: 661, mu: 1.05 },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 940,
    beltHMm: 990,
    cowlXMm: -560,
    roofFrontXMm: -1340,
    roofRearXMm: -2550,
    tailHMm: 1050,
    paint: '#5e6266',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-m177',
    // A short V8 pushed back so its front cylinders sit just behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -290,
    crankYMm: 460,
    gearbox: 'inline',
    gearboxKg: 90,
    driven: 'rear',
    fuelTank: { litres: 66, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 355 },
  bodyCgFrac: 0.5,
  blurb: 'A big V8 pushed back behind the front axle of a compact coupé, driving the rear wheels.',
  published: {
    curbKg: 1725,
    frontPct: 54,
    source:
      'C 63 S Coupé (C205): 375 kW (510 PS) / 700 Nm, 255/35 R19 + 285/30 R20, 355 L — auto-motor-und-sport.de test data (05/2016); 4751 × 1877 × 1401 mm, wheelbase 2840 — ADAC Autokatalog (C 63 S Coupé); ~ kerb 1725 kg DIN, the 1800 kg EU figure (AMS, C 63 S Coupé Edition 1) less the 75 kg driver; 54:46 split as AMG quoted for the V8 C 63 (via Car Throttle on the W206); ~ tracks 1624/1585 not re-checked (AMS lists 1588/1570), the model measures 1626/1599; ~ front overhang measured on the model; the model’s title says C63, the S tune is kept',
  },
};

export default v;
