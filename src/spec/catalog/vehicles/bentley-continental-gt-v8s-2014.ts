import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bentley-continental-gt-v8s-2014',
  name: 'Bentley Continental GT V8 S (2nd gen)',
  archetype: 'luxury',
  years: '2011–2018',
  examples: [
    'Bentley Continental GT W12 (2003–2018)',
    'VW Phaeton (same D1 platform)',
    'Audi A8 / S8 quattro (engine ahead of the front axle)',
  ],
  dims: {
    wheelbaseMm: 2746,
    trackFMm: 1664,
    trackRMm: 1655,
    lengthMm: 4806,
    widthMm: 1943,
    heightMm: 1404,
    overhangFMm: 955,
  },
  // 275/40 ZR20 all round
  // μ (lateral peak) 0.97, set so the sim's 100–0 km/h stop matches: 60–0 mph ~118 ft ≈ 38.6 m from
  // 100 km/h — MotorWeek road test, 2014
  // ~ kind: OE Pirelli P Zero
  tires: { widthFMm: 275, widthRMm: 275, diameterMm: 728, mu: 0.97, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 970,
    beltHMm: 1020,
    cowlXMm: -460,
    roofFrontXMm: -980,
    roofRearXMm: -2550,
    tailHMm: 1050,
    paint: '#1e3a2f',
  },
  bay: { widthMm: 1300, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ea825',
    // The engine sits almost entirely ahead of the front axle, VW-Group longitudinal style.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 150,
    crankYMm: 480,
    // ZF 8-speed automatic with a Torsen centre differential behind it.
    gearbox: 'inline',
    gearboxKg: 120,
    driven: 'all',
    awd: 'center-diff',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 90, xMm: -2250 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 358 },
  bodyCgFrac: 0.52,
  blurb:
    'A heavy grand tourer with its V8 hung over the nose and permanent four-wheel drive to put the power down.',
  published: {
    curbKg: 2195,
    frontPct: 55,
    source:
      'Wheelbase 2746, 4806 × 1943 × 1404 mm, tracks 1664/1655, kerb 2195 kg (2295 kg EU), 90 L, 275/40 R20 — cars-data.com; 4.0 twin-turbo 389 kW (528 PS) / 680 Nm, ZF 8-speed — Bentley via conceptcarz; 40:60 Torsen split — Autotrader.ca; ~ 55/45: Winding Road quotes 55/45 for the GTC V8 (the W12 car was 57/43, Autotrader.ca); engine almost entirely ahead of the front axle — road test reprint (germancarforum.com); EA824 4.0 TFSI (84.5 × 89 mm) shown with its EA825 successor; ~ overhang from the 3D model',
  },
};

export default v;
