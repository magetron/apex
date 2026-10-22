import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-m3-cs-touring-g81',
  name: 'BMW M3 CS Touring (G81)',
  archetype: 'estate',
  examples: ['BMW M3 Competition Touring (G81)', 'Audi RS 4 Avant (B9)', 'BMW M3 CS (G80)'],
  years: '2025–',
  dims: {
    wheelbaseMm: 2857,
    trackFMm: 1623,
    trackRMm: 1605,
    lengthMm: 4796,
    widthMm: 1918,
    heightMm: 1447,
    overhangFMm: 861,
  },
  // 275/35 ZR19 front, 285/30 ZR20 rear
  // μ (lateral peak) 1.09, set so the sim's 100–0 km/h stop matches: 100–0 km/h 33.6 m cold / 32.1
  // m warm — Auto Bild, 2025
  // ~ kind: OE summer (Cup 2 R optional)
  tires: { widthFMm: 275, widthRMm: 285, diameterMm: 677, mu: 1.09, kind: 'performance' },
  body: {
    style: 'estate',
    tail: 'hatch',
    bonnetHMm: 940,
    beltHMm: 990,
    cowlXMm: -580,
    roofFrontXMm: -1360,
    roofRearXMm: -3500,
    tailHMm: 1150,
    paint: '#1f7a4d',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'i6-s58-cs',
    // Front-mid like every longitudinal BMW: the inline-6 sits behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -300,
    crankYMm: 440,
    gearbox: 'inline',
    gearboxKg: 110,
    driven: 'all',
    // M xDrive: rear axle always driven; a multi-plate clutch in the transfer case behind the
    // 8-speed sends torque forward only as needed, and can be switched off (2WD mode).
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 59, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 500 },
  bodyCgFrac: 0.52,
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 20, posMm: [-3400, 400, 300] },
  ],
  blurb:
    'An M3 estate: the inline-6 behind the front axle, rear-biased all-wheel drive and a long roof over the rear axle.',
  published: {
    curbKg: 1850,
    frontPct: 53,
    source:
      'Kerb 1850 kg DIN (1925 kg EU), 4796 × 1918 × 1447 mm, wheelbase 2857, overhang 861/1078, track 1623/1605, 59 L, 275/35 ZR19 + 285/30 ZR20, 70 Ah battery in the luggage compartment, S58 405 kW / 650 Nm — BMW Media information 01/2025 (M3 CS Touring); ~ 53/47 split estimated (BMW M quotes 53.9/46.1 for the M4 Competition M xDrive coupé); ~ 0.4 front share: xDrive’s nominal, M xDrive varies it',
  },
};

export default v;
