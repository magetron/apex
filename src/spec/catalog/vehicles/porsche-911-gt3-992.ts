import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-911-gt3-992',
  name: 'Porsche 911 GT3 (992)',
  archetype: 'sports',
  examples: ['Porsche 911 GT3 RS (992)', 'Porsche 911 GT3 (996–991)', 'Porsche 911 Carrera (992)'],
  dims: {
    wheelbaseMm: 2457,
    trackFMm: 1601,
    trackRMm: 1553,
    lengthMm: 4573,
    widthMm: 1852,
    heightMm: 1279,
    // ~ measured on the scaled model (the Carrera S Cabriolet model measures 1023)
    overhangFMm: 1045,
  },
  // 255/35 R20 front, 315/30 R21 rear
  // μ (lateral peak) 1.07, set so the sim's 100–0 km/h stop matches: 100–0 km/h 33.0 m cold / 32.3
  // m warm — Auto Zeitung, Jul 2021
  // kind: Michelin Pilot Sport Cup 2 R on the Auto Zeitung car; ~ OE Cup 2
  tires: { widthFMm: 255, widthRMm: 315, diameterMm: 704, mu: 1.07, kind: 'cup' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 770,
    beltHMm: 890,
    cowlXMm: -600,
    roofFrontXMm: -1150,
    roofRearXMm: -1950,
    tailHMm: 960,
    paint: '#d7dadf',
  },
  bay: { widthMm: 1300, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'flat6-gt3',
    // The Carrera's layout (engine behind the rear axle, transaxle ahead of it) with the
    // naturally aspirated 4.0 from the GT3 Cup car.
    position: 'rear-overhang',
    orientation: 'longitudinal',
    engineXMm: -2737,
    crankYMm: 365,
    gearbox: 'mid-transaxle',
    gearboxKg: 110,
    driven: 'rear',
    fuelTank: { litres: 64, xMm: 150 },
  },
  chassis: 'monocoque',
  // the first 911 road car with double wishbones at the front
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 132 },
  bodyCgFrac: 0.53,
  blurb:
    'The Carrera’s rear-hung layout with a race-derived 9000 rpm engine and double wishbones up front.',
  published: {
    curbKg: 1435,
    frontPct: 39,
    source:
      'Wheelbase 2457, track 1601/1553, 4573 × 1852 × 1279 mm, 255/35 R20 + 315/30 R21, 375 kW / 470 Nm — auto motor und sport Supertest data (CarExpert agrees); kerb 1435 kg (3164 lb, PDK) — Porsche via MotorWeek; ~ 39/61 split estimated (991 GT3 ~38.5/61.5); ~ overhang and engine position as the Carrera',
  },
};

export default v;
