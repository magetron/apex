import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'subaru-wrx-sti',
  name: 'Subaru WRX STI (VA)',
  archetype: 'saloon',
  examples: [
    'Subaru Impreza (every generation)',
    'Subaru Outback / Forester',
    'Mitsubishi Lancer Evolution (transverse rival)',
  ],
  dims: {
    wheelbaseMm: 2650,
    trackFMm: 1530,
    trackRMm: 1540,
    lengthMm: 4595,
    widthMm: 1795,
    heightMm: 1475,
    overhangFMm: 950,
  },
  // 245/40 R18
  // μ (lateral peak) 0.95, set so the sim's lateral limit matches: skidpad 0.90 g, 300 ft — Car and
  // Driver, 2015
  // ~ kind: OE 18-inch summer
  tires: { widthFMm: 245, widthRMm: 245, diameterMm: 653, mu: 0.95, kind: 'performance' },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 930,
    beltHMm: 990,
    cowlXMm: -450,
    roofFrontXMm: -1250,
    roofRearXMm: -2650,
    tailHMm: 1080,
    paint: '#1f4fa3',
  },
  bay: { widthMm: 1250, lengthMm: 800 },
  powertrain: {
    kind: 'ice',
    engine: 'flat4',
    // The boxer sits ahead of the front axle, low; gearbox, centre diff and prop shaft run
    // straight down the centre line — the "symmetrical" driveline.
    position: 'front-overhang',
    orientation: 'longitudinal',
    engineXMm: 320,
    crankYMm: 400,
    gearbox: 'inline',
    gearboxKg: 75,
    driven: 'all',
    // DCCD: planetary centre diff, 41:59, with a mechanical LSD and an electromagnetic clutch
    // that locks it (automatically, or in steps up to fully locked by the driver).
    awd: 'center-diff',
    frontTorqueShare: 0.41,
    awdDevice: { type: 'locking-clutch', name: 'DCCD', lockable: true },
    fuelTank: { litres: 60, xMm: -2200 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'double-wishbone' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 460 },
  bodyCgFrac: 0.48,
  blurb: 'A low boxer engine and a driveline laid out symmetrically along the car’s centre line.',
  published: {
    curbKg: 1525,
    frontPct: 59,
    source:
      'Kerb 1505–1534 kg across STI variants (vehiclescore.co.uk); 41:59 DCCD torque split (2015 road test via German Car Forum); DCCD = planetary centre diff with a mechanical LSD plus an electronically controlled locking clutch, auto and manual lock modes (Subaru WRX STI press kit, media.subaru.com; Jalopnik 2007); ~ dims from Subaru data, not re-checked; ~ 59/41 split estimated',
  },
};

export default v;
