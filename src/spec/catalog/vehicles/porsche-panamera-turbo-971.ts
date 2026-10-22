import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-panamera-turbo-971',
  name: 'Porsche Panamera Turbo (971)',
  archetype: 'luxury',
  examples: [
    'Porsche Panamera (all, 970/971/976)',
    'Porsche Cayenne (9Y0)',
    'Bentley Continental GT (3rd gen)',
  ],
  dims: {
    wheelbaseMm: 2950,
    trackFMm: 1657,
    trackRMm: 1639,
    lengthMm: 5049,
    widthMm: 1937,
    heightMm: 1427,
    overhangFMm: 970,
  },
  // 275/40 R20 front, 315/35 R20 rear
  tires: { widthFMm: 275, widthRMm: 315, diameterMm: 728, mu: 1.0 },
  body: {
    style: 'fastback',
    tail: 'hatch',
    bonnetHMm: 900,
    beltHMm: 960,
    cowlXMm: -650,
    roofFrontXMm: -1400,
    roofRearXMm: -2650,
    tailHMm: 1000,
    paint: '#2b2d2f',
  },
  bay: { widthMm: 1300, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-ea825',
    // Front-mid: the V8 sits behind the front axle, the front half shaft runs through its sump.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -230,
    crankYMm: 430,
    gearbox: 'inline',
    gearboxKg: 125,
    driven: 'all',
    // PTM: RWD at heart; a multi-plate clutch at the PDK's front output feeds the front axle.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.3,
    fuelTank: { litres: 90, xMm: -2500 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 495 },
  bodyCgFrac: 0.5,
  blurb:
    'A four-door 911 in spirit but front-engined: the V8 sits behind the front axle, and the rear wheels do most of the work.',
  published: {
    curbKg: 1995,
    frontPct: 54.4,
    source:
      'Kerb 1995 kg DIN (2070 kg EU) and 54.4/45.6 split — WhichCar "Porsche Panamera Turbo: 10 little things"; 5049 × 1937 × 1427 mm, wheelbase 2950 mm, tracks 1657/1639 mm, 275/40 R20 + 315/35 R20, 90 L tank — ultimatespecs.com (Porsche data); EA825 here 404 kW / 770 Nm, 8-speed PDK, PTM — Porsche',
  },
};

export default v;
