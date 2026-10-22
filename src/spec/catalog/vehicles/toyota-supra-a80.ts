import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'toyota-supra-a80',
  name: 'Toyota Supra SZ-R (A80)',
  archetype: 'sports',
  examples: [
    'Toyota Supra RZ (A80, twin-turbo 2JZ-GTE)',
    'Lexus SC300 (Z30)',
    'Nissan 300ZX (Z32)',
  ],
  years: '1993–2002',
  dims: {
    wheelbaseMm: 2550,
    trackFMm: 1520,
    trackRMm: 1525,
    lengthMm: 4520,
    widthMm: 1810,
    heightMm: 1275,
    overhangFMm: 965,
  },
  // 225/50 ZR16 front, 245/50 ZR16 rear
  tires: { widthFMm: 225, widthRMm: 245, diameterMm: 641, mu: 0.95 },
  body: {
    style: 'coupe',
    tail: 'hatch',
    bonnetHMm: 870,
    beltHMm: 920,
    cowlXMm: -650,
    roofFrontXMm: -1350,
    roofRearXMm: -2300,
    tailHMm: 1000,
    paint: '#c8102e',
  },
  bay: { widthMm: 1100, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6-2jz-ge',
    // The long straight-six sits behind the front axle line; a five-speed W58 bolts on behind.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -230,
    crankYMm: 400,
    gearbox: 'inline',
    gearboxKg: 45,
    driven: 'rear',
    fuelTank: { litres: 70, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 290 },
  bodyCgFrac: 0.55,
  blurb:
    'A long straight-six behind the front axle driving the rear wheels: the classic front-engine sports-car recipe.',
  published: {
    curbKg: 1430,
    frontPct: 51,
    source:
      'SZ-R (E-JZA80, 1994): 4520 × 1810 × 1275 mm, wheelbase 2550, tracks 1520/1525, kerb 1430 kg (5-speed; 1450 kg with the later 6-speed), 70 L, FR — toyota.jp used-car catalogue; 51:49 split for the non-turbo car (53:47 turbo), W58 five-speed, double wishbones all round — Wikipedia "Toyota Supra"; 225/50 ZR16 + 245/50 ZR16 — carfromjapan.com listing (~); ~ front overhang from the 3D model; ~ tank position and luggage estimated',
  },
};

export default v;
