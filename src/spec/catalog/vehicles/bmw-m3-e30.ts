import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-m3-e30',
  name: 'BMW M3 Evolution II (E30)',
  archetype: 'sports',
  examples: ['BMW 3 Series (E30)', 'Mercedes 190E 2.3-16 (W201)'],
  years: '1988',
  dims: {
    wheelbaseMm: 2562,
    trackFMm: 1412,
    trackRMm: 1424,
    lengthMm: 4345,
    widthMm: 1680,
    heightMm: 1370,
    overhangFMm: 770,
  },
  // 225/45 R16
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 609, mu: 0.95 },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 860,
    beltHMm: 930,
    cowlXMm: -620,
    roofFrontXMm: -1250,
    roofRearXMm: -2450,
    tailHMm: 1020,
    paint: '#b3121c',
  },
  bay: { widthMm: 1100, lengthMm: 900 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-s14',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -160,
    crankYMm: 400,
    gearbox: 'inline',
    gearboxKg: 40,
    driven: 'rear',
    fuelTank: { litres: 70, xMm: -2350 },
  },
  chassis: 'monocoque',
  // Rear: semi-trailing arms.
  suspension: { front: 'macpherson', rear: 'trailing-arm' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 410 },
  bodyCgFrac: 0.52,
  blurb: 'A homologation special: a high-revving four set well back in a light rear-drive coupé.',
  published: {
    curbKg: 1200,
    frontPct: 51,
    source:
      'Evolution II (the model’s car): 162 kW (220 PS) / 245 Nm, about 500 built in 1988, lighter bootlid and rear glass — Wikipedia "BMW M3", BMW Group Classic; dims 2562 wb / 4345 × 1680 × 1370 mm, kerb ~1200 kg (range 1165–1360; the Evo II about 10 kg lighter), 225/45 R16 — BMW via Wikipedia "BMW M3 (E30)"; ~ 51/49 split estimated (described as near-even with a slight front bias); ~ tracks, 70 L tank',
  },
};

export default v;
