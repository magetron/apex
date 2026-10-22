import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-m340i-g20',
  name: 'BMW M340i (G20)',
  archetype: 'saloon',
  examples: ['BMW 3 Series (all)', 'Toyota Supra (A90, same B58 engine)'],
  dims: {
    wheelbaseMm: 2851,
    trackFMm: 1583,
    trackRMm: 1567,
    lengthMm: 4709,
    widthMm: 1827,
    heightMm: 1442,
    overhangFMm: 815, // measured on the 3D model (no published figure found)
  },
  // 225/45 R18 front, 255/40 R18 rear
  tires: { widthFMm: 225, widthRMm: 255, diameterMm: 661, mu: 1.0 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 950,
    beltHMm: 1000,
    cowlXMm: -570,
    roofFrontXMm: -1350,
    roofRearXMm: -2700,
    tailHMm: 1060,
    paint: '#1f4e9c',
  },
  bay: { widthMm: 1200, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6',
    position: 'front-mid',
    orientation: 'longitudinal',
    // Front-mid: the whole inline-6 sits behind the front axle line.
    engineXMm: -280,
    crankYMm: 430,
    engineTiltDeg: 0,
    gearbox: 'inline',
    gearboxKg: 85,
    driven: 'rear',
    fuelTank: { litres: 59, xMm: -2300 },
  },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 480 },
  bodyCgFrac: 0.54,
  // BMW moves the 12 V battery into the boot to help the 50:50 split.
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 20, posMm: [-3300, 400, 300] },
  ],
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  blurb:
    'The classic recipe: a long, smooth inline-6 behind the front axle, driving the rear wheels.',
  published: {
    curbKg: 1690,
    frontPct: 50,
    source:
      'Track 1583/1567, 225/45 R18 + 255/40 R18, 59 L, 80 Ah battery in the boot — BMW Media information 10/2019 (M340i xDrive Limousine: 4713 × 1827 × 1440 mm, wheelbase 2851, 1670 kg DIN); ~ kerb 1690 kg (RWD) and length/height not re-checked; ~ 815 mm front overhang measured on the 3D model; BMW quotes ~50:50 for the 3 Series (Bimmerfile measured 51.5/48.5 on an xDrive car); B58 285 kW / 500 Nm',
  },
};

export default v;
