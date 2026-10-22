import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'bmw-x3-m40i-g01',
  name: 'BMW X3 M40i (G01)',
  archetype: 'suv',
  examples: ['BMW X4 M40i (G02)', 'BMW X5 (G05)', 'Mercedes-AMG GLC 43'],
  years: '2018–2024',
  dims: {
    wheelbaseMm: 2864,
    trackFMm: 1615,
    trackRMm: 1594,
    lengthMm: 4716,
    widthMm: 1897,
    heightMm: 1676,
    overhangFMm: 867,
  },
  // 245/45 R20 front, 275/40 R20 rear
  // ~ μ (lateral peak) 1.02, set so the sim's 100–0 km/h stop matches: 36.2 m from 100 km/h cold:
  // the X4 M40i (its coupé twin) — Auto Zeitung, ~2020
  // ~ kind: OE 20-21-inch summer
  tires: { widthFMm: 245, widthRMm: 275, diameterMm: 728, mu: 1.02, kind: 'performance' },
  body: {
    style: 'suv',
    tail: 'hatch',
    bonnetHMm: 1020,
    beltHMm: 1100,
    cowlXMm: -470,
    roofFrontXMm: -1300,
    roofRearXMm: -3250,
    tailHMm: 1350,
    paint: '#1b3f73',
  },
  bay: { widthMm: 1200, lengthMm: 1050 },
  powertrain: {
    kind: 'ice',
    engine: 'i6',
    // Front-mid like every longitudinal BMW: the inline-6 sits behind the front axle line.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -250,
    crankYMm: 490,
    gearbox: 'inline',
    gearboxKg: 95,
    driven: 'all',
    // xDrive: rear axle always driven, a multi-plate clutch in the transfer case behind the
    // gearbox sends torque forward (nominally 40:60).
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.4,
    fuelTank: { litres: 65, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 550 },
  bodyCgFrac: 0.545,
  // BMW puts the 12 V battery in the boot for the 50:50 split.
  extraMasses: [
    { id: 'battery-12v', label: '12 V battery (in the boot)', kg: 25, posMm: [-3300, 450, 300] },
  ],
  blurb:
    'A tall 3 Series: inline-6 behind the front axle, rear-biased all-wheel drive and a 50:50 split.',
  published: {
    curbKg: 1845,
    frontPct: 50,
    source:
      'Kerb 1845 kg DIN (1920 kg EU), 4716 × 1897 × 1676 mm, wheelbase 2864, track 1615/1594, 245/45 R20 + 275/40 R20, 65 L, 90 Ah battery in the luggage compartment, B58 265 kW / 500 Nm (EU) — BMW Media Information 04/2020 (pre-facelift; the 2021–24 LCI is ~ the same car, 285 kW in the US); 50:50 split — BMW G01 launch release (2017); ~ overhang from the model (to scale: 4716 mm long)',
  },
};

export default v;
