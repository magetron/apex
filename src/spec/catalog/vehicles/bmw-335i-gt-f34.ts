import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-335i-gt-f34',
  name: 'BMW 335i Gran Turismo (F34)',
  archetype: 'saloon',
  examples: ['BMW 3 Series (F30/F31)', 'BMW 4 Series Gran Coupé (F36)', 'BMW 5 Series GT (F07)'],
  dims: {
    wheelbaseMm: 2920,
    trackFMm: 1541,
    trackRMm: 1586,
    lengthMm: 4824,
    widthMm: 1828,
    heightMm: 1508,
    overhangFMm: 800,
  },
  // 225/55 R17 all round
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 679, mu: 0.95 },
  body: {
    style: 'fastback',
    tail: 'hatch',
    bonnetHMm: 960,
    beltHMm: 1030,
    cowlXMm: -560,
    roofFrontXMm: -1350,
    roofRearXMm: -2950,
    tailHMm: 1100,
    paint: '#5a3a2e',
  },
  bay: { widthMm: 1200, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6',
    // Same front end as the F30 saloon: the inline-6 sits behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -280,
    crankYMm: 430,
    gearbox: 'inline',
    gearboxKg: 85,
    driven: 'rear',
    fuelTank: { litres: 60, xMm: -2400 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 520 },
  bodyCgFrac: 0.54,
  // BMW puts the 12 V battery in the boot.
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 25, posMm: [-3450, 400, 300] },
  ],
  blurb:
    'A 3 Series stretched 110 mm between the axles and given a hatch: the same inline-6 behind the front axle, driving the rear wheels.',
  published: {
    curbKg: 1650,
    frontPct: 49.5,
    source:
      'Kerb 1650 kg DIN (335i GT Steptronic, RWD; 1640 kg manual, 1725 kg EU) — BMW media kit 03/2013; 4824 × 1828 × 1508 mm, wheelbase 2920 mm, tracks 1541/1586 mm, 60 L tank, 90 Ah battery in the boot, N55 225 kW / 400 Nm — BMW media information 03/2014; ~ 49.5/50.5 split: BMW lists 50.2 % front for the heavier xDrive car (Canada product guide)',
  },
};

export default v;
