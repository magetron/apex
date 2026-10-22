import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'renault-megane-rs-x95',
  name: 'Renault Mégane RS 250 Cup (X95)',
  archetype: 'hot-hatch',
  examples: ['VW Golf GTI (Mk6)', 'Seat León Cupra (Mk2)', 'Ford Focus RS (Mk2)'],
  years: '2010–2012',
  dims: {
    wheelbaseMm: 2636,
    trackFMm: 1588,
    trackRMm: 1545,
    lengthMm: 4299,
    widthMm: 1848,
    heightMm: 1435,
    overhangFMm: 875,
  },
  // 235/40 R18 (Cup chassis)
  // μ (lateral peak) 0.95, set so the sim's 100–0 km/h stop matches: 100–0 km/h 37.9 m cold / 36.2
  // m warm — Auto Bild, Mar 2014 (Mégane RS 265)
  // ~ kind: OE 18-inch summer
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 645, mu: 0.95, kind: 'performance' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 900,
    beltHMm: 990,
    cowlXMm: -250,
    roofFrontXMm: -1150,
    roofRearXMm: -2350,
    tailHMm: 1130,
    paint: '#f2c200',
  },
  bay: { widthMm: 1100, lengthMm: 640 },
  powertrain: {
    kind: 'ice',
    engine: 'i4',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 420,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    // 6-speed manual; the Cup chassis adds a limited-slip differential
    gearboxKg: 60,
    driven: 'front',
    fuelTank: { litres: 60, xMm: -2050 },
  },
  chassis: 'monocoque',
  // front: MacPherson with a separate steering knuckle (PerfoHub) to cut torque steer
  suspension: { front: 'macpherson', rear: 'twist-beam' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 344 },
  bodyCgFrac: 0.43,
  blurb:
    'A front-drive car built for lap times: the steering axis is split from the strut so 250 PS can go through the front wheels without wringing the wheel.',
  published: {
    curbKg: 1362,
    frontPct: 63,
    source:
      'Wb 2636, tracks 1588/1545, 4299 × 1848 × 1435 mm, kerb 1362 kg, 60 L tank, F4Rt 2.0 turbo 250 PS — cars-data.com (Mégane Coupé 2.0 16V T 250 RS, 2010); the i4 spec (EA888-class, 82.5 × 92.8 mm, 180 kW / 370 Nm) stands in for the F4Rt (82.7 × 93 mm, 184 kW / 340 Nm); ~ 235/40 R18 Cup tyres; ~ 63/37 split estimated (no published figure found); ~ front overhang measured on the 3D model; engine position estimated',
  },
};

export default v;
