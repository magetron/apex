import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'nissan-370z-z34',
  name: 'Nissan 370Z (Z34)',
  archetype: 'sports',
  years: '2009–2020',
  examples: [
    'Nissan 350Z (Z33, same FM platform)',
    'Infiniti G37 / Q60 coupé',
    'Toyota GR Supra (A90, front-mid inline-6)',
  ],
  dims: {
    wheelbaseMm: 2550,
    trackFMm: 1540,
    trackRMm: 1565,
    lengthMm: 4250,
    widthMm: 1845,
    heightMm: 1315,
    overhangFMm: 830,
  },
  // 245/40 R19 front, 275/35 R19 rear
  tires: { widthFMm: 245, widthRMm: 275, diameterMm: 677, mu: 1.0 },
  body: {
    style: 'coupe',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 960,
    cowlXMm: -560,
    roofFrontXMm: -1200,
    roofRearXMm: -2050,
    tailHMm: 1030,
    paint: '#e4e2dc',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v6-60',
    // "Front-midship": the V6 sits just behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -250,
    crankYMm: 430,
    gearbox: 'inline',
    gearboxKg: 70,
    driven: 'rear',
    fuelTank: { litres: 72, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 235 },
  bodyCgFrac: 0.5,
  blurb:
    'A short, wide two-seater: the V6 sits behind the front axle, the gearbox and prop shaft run back to the rear wheels.',
  published: {
    curbKg: 1471,
    frontPct: 53,
    source:
      'Kerb 1471 kg and 53/47 split — Nissan via GoAuto (2009 launch); 53/47 also on the 2015 370Z NISMO spec sheet (ZCCA); tracks 1540/1565 — Motorsport Australia Group 3E recognition sheet (iSeeCars 60.6/61.6 in; some trims list 61.0/62.8 in); wheelbase 2550, base manual 3245 lb — Autobytel, J.D. Power; ~ length/width/height 4250 × 1845 × 1315 from Nissan data, not re-checked; ~ overhang from the 3D model',
  },
};

export default v;
