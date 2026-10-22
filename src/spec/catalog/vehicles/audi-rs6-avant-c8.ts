import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-rs6-avant-c8',
  name: 'Audi RS 6 Avant (C8)',
  archetype: 'saloon',
  examples: ['Audi RS 7 Sportback (C8)', 'Audi S6/A6 Avant (C8)', 'Mercedes-AMG E 63 S Estate'],
  dims: {
    wheelbaseMm: 2928,
    trackFMm: 1668,
    trackRMm: 1650,
    lengthMm: 4995,
    widthMm: 1951,
    heightMm: 1497,
    overhangFMm: 955,
  },
  // 285/30 R22 all round (the optional 22s the model wears; 275/35 R21 standard)
  // μ (lateral peak) 1.11, set so the sim's 100–0 km/h stop matches: 100–0 km/h ≈ 33.8 m (11.4
  // m/s²) — auto motor und sport (vs Alpina B5, E 63 S T)
  // kind: Conti SportContact 7 (Auto Bild, RS 6 performance)
  tires: { widthFMm: 285, widthRMm: 285, diameterMm: 730, mu: 1.11, kind: 'performance' },
  body: {
    style: 'estate',
    tail: 'hatch',
    bonnetHMm: 960,
    beltHMm: 1010,
    cowlXMm: -520,
    roofFrontXMm: -1350,
    roofRearXMm: -3250,
    tailHMm: 1130,
    paint: '#8a8f93',
  },
  bay: { widthMm: 1300, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ea825',
    // Audi's longitudinal layout: the whole V8 hangs ahead of the front axle, the front
    // differential sits between engine and gearbox.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 260,
    // ~ crank height: at 470 mm the hot-vee turbos stood through the measured bonnet line
    crankYMm: 415,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Permanent quattro: purely mechanical (Torsen-type) centre differential, 40:60 front:rear;
    // on slip it sends up to 70 % to the front or 85 % to the rear.
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    awdDevice: { type: 'torque-sensing', frontRange: [0.15, 0.7] },
    fuelTank: { litres: 73, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'multilink', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 565 },
  bodyCgFrac: 0.5,
  blurb:
    'A family estate with a twin-turbo V8 hung ahead of the front axle and a rear-biased centre differential.',
  published: {
    curbKg: 2075,
    frontPct: 57.5,
    source:
      'Kerb 2075 kg DIN (2150 kg EU, RS 6 441 kW) — autotijd.be; 4995 × 1951 × 1497 mm (incl. roof rails), tracks 1668/1650 mm, 275/35 R21 or 285/30 R22 — CarExpert, cararac.com, vehiclesizes.com; ~ wheelbase 2928 mm (sources list 2924–2934 mm); 40:60 centre-diff split, up to 70 % front or 85 % rear on slip, 48 V starter-generator (modelled as a plain ICE) — Audi MediaCenter (RS 6 Avant C8, transmission); ~ 73 L tank; ~ 57.5/42.5 split estimated (reviews quote "almost 60:40" for the RS 7)',
  },
};

export default v;
