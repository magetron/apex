import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mazda-mx5-nd',
  name: 'Mazda MX-5 2.0 (ND)',
  archetype: 'roadster',
  examples: ['Fiat 124 Spider (2016, same platform)', 'Toyota GR86 / Subaru BRZ (FR coupé)'],
  dims: {
    wheelbaseMm: 2310,
    trackFMm: 1495,
    trackRMm: 1505,
    lengthMm: 3915,
    widthMm: 1735,
    heightMm: 1235,
    overhangFMm: 760,
  },
  // 205/45 R17
  // μ (lateral peak) 0.96, set so the sim's 100–0 km/h stop matches: 100–0 km/h 37.2 m cold / 35.2
  // m warm — sport auto, Roadster (quoted on mx5-nd-forum.de)
  // ~ kind: OE Bridgestone Potenza S001 (2.0)
  tires: { widthFMm: 205, widthRMm: 205, diameterMm: 616, mu: 0.96, kind: 'performance' },
  body: {
    style: 'roadster',
    tail: 'notch',
    bonnetHMm: 800,
    beltHMm: 860,
    cowlXMm: -820,
    roofFrontXMm: -1170,
    roofRearXMm: -1750,
    tailHMm: 900,
    paint: '#9e0d1b',
  },
  bay: { widthMm: 1050, lengthMm: 850 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-skyactiv',
    // Mazda put the whole engine behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -250,
    crankYMm: 380,
    gearbox: 'inline',
    gearboxKg: 45,
    driven: 'rear',
    fuelTank: { litres: 45, xMm: -1900 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 130 },
  bodyCgFrac: 0.54,
  blurb: 'Small, light and evenly balanced, with the whole engine behind the front axle line.',
  published: {
    curbKg: 1060,
    frontPct: 50,
    source:
      'Mazda claims a near 50:50 split (Mazda Philippines); kerb ~1060 kg (published range 990–1060 kg); ~ dims 2310 wb / 3915 × 1735 × 1235 mm from Mazda data, not re-checked',
  },
};

export default v;
