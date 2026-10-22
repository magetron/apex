import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mazda-rx8-se3p',
  name: 'Mazda RX-8 (SE3P)',
  archetype: 'sports',
  years: '2003–2012',
  examples: [
    'Mazda RX-7 (FD3S, front-midship rotary)',
    'Mazda MX-5 (ND, engine behind the front axle)',
    'Nissan 370Z (Z34, front-midship FR)',
  ],
  dims: {
    wheelbaseMm: 2700,
    trackFMm: 1500,
    trackRMm: 1505,
    lengthMm: 4425,
    widthMm: 1770,
    heightMm: 1340,
    overhangFMm: 823,
  },
  // 225/45 R18 all round (Type S / 6-speed)
  // ~ μ (lateral peak) 1.01, set so the sim's 100–0 km/h stop matches: ~36 m from 100 km/h
  // (auto-data.net lists 36 m, unsourced); no test found
  // ~ kind: OE 18-inch summer
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 660, mu: 1.01, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'notch',
    bonnetHMm: 840,
    beltHMm: 930,
    cowlXMm: -650,
    roofFrontXMm: -1350,
    roofRearXMm: -2300,
    tailHMm: 1000,
    paint: '#8a1020',
  },
  bay: { widthMm: 1100, lengthMm: 950 },
  powertrain: {
    kind: 'ice',
    engine: 'rotary-13b-msp',
    // Mazda's "front midship": the short, low rotary sits wholly behind the front axle line
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -200,
    crankYMm: 370,
    gearbox: 'inline',
    gearboxKg: 50,
    driven: 'rear',
    fuelTank: { litres: 61, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 290 },
  bodyCgFrac: 0.53,
  blurb:
    'A four-seater balanced like a two-seat roadster: the compact rotary sits behind the front axle, so the weight splits evenly front to rear.',
  published: {
    curbKg: 1373,
    frontPct: 50,
    source:
      'Wheelbase 2700, tracks 1500/1505, 4435 × 1770 × 1340 mm (JP), engine 40 mm lower and 60 mm further back than the RX-7, "front midship" — Mazda news release (9 Apr 2003); 4425 mm length (2003–08), kerb 1309–1373 kg manual (1373 kg: heaviest manual, US 6-speed), 50:50 split claim, fuel tank ahead of the rear axle — Wikipedia "Mazda RX-8"; 61 L tank — Mazda RX-8 service manual; 225/45 R18 — Mazda release; ~ engine x and crank height, gearbox mass estimated; ~ 823 mm front overhang from the 3D model (whose aftermarket wheels stand ~30 mm further out a side than the factory tracks)',
  },
};

export default v;
