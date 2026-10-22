import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'fiat-500-1957',
  name: 'Fiat 500 F (Nuova 500)',
  archetype: 'city',
  examples: ['Fiat 126', 'VW Beetle (same rear-engine recipe, flat-4)', 'Hillman Imp'],
  years: '1965–1972',
  dims: {
    wheelbaseMm: 1840,
    trackFMm: 1121,
    trackRMm: 1135,
    lengthMm: 2970,
    widthMm: 1320,
    heightMm: 1325,
    overhangFMm: 500,
  },
  // 125 R12 radials on 12-inch wheels
  tires: { widthFMm: 125, widthRMm: 125, diameterMm: 520, mu: 0.8 },
  body: {
    style: 'city',
    tail: 'engine-deck',
    bonnetHMm: 780,
    beltHMm: 850,
    cowlXMm: -330,
    roofFrontXMm: -720,
    roofRearXMm: -1720,
    tailHMm: 880,
    paint: '#a9c9d6',
  },
  bay: { widthMm: 800, lengthMm: 500 },
  powertrain: {
    kind: 'ice',
    engine: 'i2-air',
    position: 'rear-overhang',
    orientation: 'longitudinal',
    // The twin hangs behind the rear axle; the 4-speed transaxle sits between it and the axle.
    engineXMm: -2110,
    crankYMm: 330,
    gearbox: 'mid-transaxle',
    gearboxKg: 30,
    driven: 'rear',
    // The tank lives in the front compartment, next to the spare wheel.
    fuelTank: { litres: 21, xMm: 150 },
  },
  chassis: 'monocoque',
  // Front: transverse leaf spring as the lower link plus upper arms; rear: semi-trailing arms.
  suspension: { front: 'double-wishbone', rear: 'trailing-arm' },
  seats: { layout: '4', rows: 2 },
  luggageL: { front: 60 },
  bodyCgFrac: 0.53,
  extraMasses: [
    { id: 'spare-wheel', label: 'Spare wheel (front compartment)', kg: 9, posMm: [250, 350, 0] },
  ],
  blurb:
    'An air-cooled twin behind the rear axle: the cheapest way to fit four people into a tiny car.',
  published: {
    curbKg: 499,
    frontPct: 41,
    source:
      '500 F (the model is a 1965 car; front-hinged doors from 1965): dims 1840 wb / 2970 × 1320 × 1325 mm, track 1121/1135, kerb 499 kg — Fiat via Wikipedia "Fiat 500" (the 1957 car was 470 kg), "a little over 500 kg" for a 1965 500 F (Dore & Rees); ~ 41/59 split estimated (no published figure found; RR like the VW Beetle ~41/59); ~ front overhang',
  },
};

export default v;
