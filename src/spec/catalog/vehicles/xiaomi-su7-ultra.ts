import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'xiaomi-su7-ultra',
  name: 'Xiaomi SU7 Ultra',
  archetype: 'ev',
  examples: ['Tesla Model S Plaid', 'Porsche Taycan Turbo GT', 'Lucid Air Sapphire'],
  dims: {
    wheelbaseMm: 3000,
    trackFMm: 1672,
    trackRMm: 1649,
    lengthMm: 5115,
    widthMm: 1970,
    heightMm: 1465,
    overhangFMm: 980,
  },
  // 265/35 R21 front, 305/30 R21 rear
  tires: { widthFMm: 265, widthRMm: 305, diameterMm: 718, mu: 1.05 },
  body: {
    style: 'fastback',
    tail: 'notch',
    bonnetHMm: 860,
    beltHMm: 960,
    cowlXMm: -300,
    roofFrontXMm: -1300,
    roofRearXMm: -2800,
    tailHMm: 1030,
    paint: '#f2c230',
  },
  bay: { widthMm: 1100, lengthMm: 600 },
  powertrain: {
    kind: 'ev',
    // Three motors: one V6s on the front axle, a V8s for EACH rear wheel (modelled as one
    // twin unit, because the contract has one motor entry per axle).
    motors: [
      { motor: 'xiaomi-v6s', axle: 'front' },
      { motor: 'xiaomi-v8s-twin', axle: 'rear' },
    ],
    battery: { kWh: 93.7, massKg: 560, lengthMm: 2300, widthMm: 1550, heightMm: 130, xMm: -1500 },
    driven: 'all',
    awd: 'dual-motor',
    // share of peak power on the front axle: 288 of 1138 kW
    frontTorqueShare: 0.25,
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { front: 105, rear: 517 },
  bodyCgFrac: 0.51,
  blurb:
    'Three motors and no gearbox: one on the front axle, one for each rear wheel, so the rear can steer with torque.',
  published: {
    curbKg: 2360,
    frontPct: 47.5,
    source:
      'Kerb 2360 kg, 5115 × 1970 × 1465 mm (MIIT; 5070 mm without the fixed wing), wheelbase 3000 mm, 93.7 kWh CATL Qilin 2.0 pack, 1 × V6s + 2 × V8s (1138 kW / 1770 Nm) — carnewschina.com, Wikipedia "Xiaomi SU7"; tracks 1672/1649 mm, 265/35 R21 + 305/30 R21 — evspecifications.com; ~ 560 kg pack and ~ 47.5/52.5 split estimated (Xiaomi quotes 50:50 for the dual-motor SU7)',
  },
};

export default v;
