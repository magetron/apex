import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-m3-f80',
  name: 'BMW M3 (F80)',
  archetype: 'saloon',
  examples: ['BMW M4 (F82)', 'BMW M2 Competition (F87, same S55)', 'BMW 3 Series (F30)'],
  years: '2014–2018',
  dims: {
    wheelbaseMm: 2812,
    trackFMm: 1579,
    trackRMm: 1603,
    lengthMm: 4671,
    widthMm: 1877,
    heightMm: 1424,
    overhangFMm: 828,
  },
  // 255/40 ZR18 front, 275/40 ZR18 rear
  tires: { widthFMm: 255, widthRMm: 275, diameterMm: 669, mu: 1.05 },
  body: {
    style: 'saloon',
    tail: 'notch',
    bonnetHMm: 930,
    beltHMm: 990,
    cowlXMm: -560,
    roofFrontXMm: -1330,
    roofRearXMm: -2650,
    tailHMm: 1040,
    paint: '#2b86c5',
  },
  bay: { widthMm: 1200, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6-s55',
    // Front-mid like every longitudinal BMW: the inline-6 sits behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -290,
    crankYMm: 430,
    gearbox: 'inline',
    gearboxKg: 70,
    driven: 'rear',
    fuelTank: { litres: 60, xMm: -2300 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 480 },
  bodyCgFrac: 0.53,
  // BMW puts the 12 V battery in the boot to help the split.
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 20, posMm: [-3300, 400, 300] },
  ],
  blurb:
    'The first turbocharged M3: a twin-turbo inline-6 behind the front axle, driving the rear wheels.',
  published: {
    curbKg: 1520,
    frontPct: 51.6,
    source:
      'Kerb 1520 kg DIN (manual; 1560 kg DCT), 4671 × 1877 × 1424 mm, wheelbase 2812, track 1579/1603, 60 L, 255/40 ZR18 + 275/40 ZR18, 69 Ah battery in the luggage compartment, S55 317 kW / 550 Nm — BMW Media information 12/2013; 51.6/48.4 split (empty car) and 32.6 in (828 mm) front overhang — BMW U.S. technical data, 2017 M3 30 Jahre Competition (US bumpers are 15 mm longer)',
  },
};

export default v;
