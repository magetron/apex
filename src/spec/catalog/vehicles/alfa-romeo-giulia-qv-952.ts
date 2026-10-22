import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'alfa-romeo-giulia-qv-952',
  name: 'Alfa Romeo Giulia Quadrifoglio (952)',
  archetype: 'saloon',
  examples: [
    'Alfa Romeo Stelvio Quadrifoglio (same platform, AWD)',
    'BMW M3 (G80)',
    'Mercedes-AMG C 63 (W205)',
  ],
  dims: {
    wheelbaseMm: 2820,
    trackFMm: 1550,
    trackRMm: 1589,
    lengthMm: 4639,
    widthMm: 1873,
    heightMm: 1426,
    overhangFMm: 800,
  },
  // 245/35 ZR19 front, 285/30 ZR19 rear
  // μ (lateral peak) 1.06, set so the sim's lateral limit matches: skidpad 1.00 g, 300 ft — Car and
  // Driver, 2017 (on optional P Zero Corsa)
  // kind: OE Pirelli P Zero; C&D test car on optional P Zero Corsa
  tires: { widthFMm: 245, widthRMm: 285, diameterMm: 654, mu: 1.06, kind: 'performance' },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 950,
    beltHMm: 1000,
    cowlXMm: -560,
    roofFrontXMm: -1080,
    roofRearXMm: -2800,
    tailHMm: 1060,
    paint: '#a3161c',
  },
  bay: { widthMm: 1250, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-690t',
    // The V6 sits behind the front axle; with a carbon prop shaft and aluminium panels the
    // saloon reaches an even split.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -300,
    crankYMm: 440,
    gearbox: 'inline',
    gearboxKg: 85,
    driven: 'rear',
    fuelTank: { litres: 58, xMm: -2300 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 480 },
  bodyCgFrac: 0.55,
  blurb:
    'A saloon with its V6 behind the front axle: the same front-mid idea as a GT, with four doors.',
  published: {
    curbKg: 1660,
    frontPct: 50,
    source:
      'Wheelbase 2820, tracks 1550/1589, 4639 × 1873 × 1426 mm, 50/50 split, 58 L tank, 245/35 + 285/30 ZR19, double wishbone front / AlfaLink rear, torque-vectoring rear diff — FCA US preliminary specs (fiat500usa.com, 2015); kerb 1660 kg as quoted by Alfa (Autocar weighed 1700 kg; 1524 kg dry, 6MT) — Autocar road test; 8-speed ZF automatic; ~ overhang from the 3D model',
  },
};

export default v;
