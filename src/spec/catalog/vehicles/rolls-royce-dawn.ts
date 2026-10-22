import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'rolls-royce-dawn',
  name: 'Rolls-Royce Dawn',
  archetype: 'luxury',
  examples: [
    'Rolls-Royce Wraith / Ghost (same platform)',
    'Bentley Continental GTC',
    'BMW 6 Series Convertible',
  ],
  years: '2015–2023',
  dims: {
    wheelbaseMm: 3112,
    trackFMm: 1618,
    trackRMm: 1665,
    lengthMm: 5285,
    widthMm: 1947,
    heightMm: 1502,
    overhangFMm: 935,
  },
  // 255/45 R20 front, 285/40 R20 rear (run-flat)
  // μ (lateral peak) 1.0, set so the sim's 100–0 km/h stop matches: 70–0 mph 162 ft ≈ 38.9 m from
  // 100 km/h — Car and Driver (via fastestlaps)
  // ~ kind: OE touring
  tires: { widthFMm: 255, widthRMm: 285, diameterMm: 737, mu: 1.0, kind: 'road' },
  body: {
    style: 'roadster',
    tail: 'notch',
    bonnetHMm: 1060,
    beltHMm: 1100,
    cowlXMm: -800,
    roofFrontXMm: -1400,
    roofRearXMm: -3000,
    tailHMm: 1080,
    paint: '#1c2a3a',
  },
  bay: { widthMm: 1400, lengthMm: 1300 },
  powertrain: {
    kind: 'ice',
    engine: 'v12-n74',
    // The V12 sits behind the front axle line; the ZF eight-speed bolts on behind it.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -380,
    crankYMm: 500,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'rear',
    fuelTank: { litres: 82, xMm: -2800 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 295 },
  bodyCgFrac: 0.54,
  blurb:
    'A twin-turbo V12 set behind the front axle of a two-and-a-half-tonne four-seat convertible, rear drive only.',
  published: {
    curbKg: 2560,
    frontPct: 50,
    source:
      'Kerb 2560 kg, 5285 × 1947 × 1502 mm, wheelbase 3112, tracks 1618/1665, 255/45 R20 + 285/40 R20, 82 L — carexpert.com.au (Rolls-Royce AU data); N74B66, 8-speed auto, RWD — cars-data.com; ~ double-wishbone front, multi-link rear air suspension as on the Ghost/Wraith; ~ 50/50 split: not published; Rolls-Royce quotes 50:50 for the Ghost it shares a platform with, and Autocar says the Dawn keeps the Wraith’s balance; ~ front overhang from the 3D model; ~ tank position and luggage estimated',
  },
};

export default v;
