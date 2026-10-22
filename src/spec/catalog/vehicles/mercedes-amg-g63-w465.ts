import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'mercedes-amg-g63-w465',
  name: 'Mercedes-AMG G 63 (W465)',
  archetype: 'offroader',
  examples: ['Mercedes-Benz G 500 (W463, 1990–2018)', 'Toyota Land Cruiser 70', 'Jeep Wrangler'],
  years: '2024–',
  dims: {
    wheelbaseMm: 2890,
    trackFMm: 1650,
    trackRMm: 1654,
    lengthMm: 4873,
    widthMm: 1984,
    heightMm: 1966,
    overhangFMm: 920,
  },
  // 275/50 R20
  // μ (lateral peak) 0.99, set so the sim's 100–0 km/h stop matches: 70–0 mph 161 ft ≈ 38.7 m from
  // 100 km/h — G 63 W463b, via fastestlaps (probably C&D)
  // ~ kind: OE road-pattern SUV tyres, not A/T (off-road behaviour already comes from body.style)
  tires: { widthFMm: 275, widthRMm: 275, diameterMm: 783, mu: 0.99, kind: 'road' },
  body: {
    style: 'offroader',
    tail: 'hatch',
    bonnetHMm: 1300,
    beltHMm: 1380,
    cowlXMm: -700,
    roofFrontXMm: -950,
    roofRearXMm: -3700,
    tailHMm: 1850,
    paint: '#4b5340',
  },
  bay: { widthMm: 1200, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-m177-g63',
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -230,
    // Sits high above the front differential and the ladder frame.
    crankYMm: 640,
    gearbox: 'inline',
    gearboxKg: 100,
    driven: 'all',
    // Transfer case with low range; centre, front and rear diffs all lockable.
    awd: 'transfer-case',
    frontTorqueShare: 0.4,
    awdDevice: { type: 'open', lockable: true },
    fuelTank: { litres: 100, xMm: -2350 },
  },
  chassis: 'ladder-frame',
  // Since 2018 the front wheels hang on double wishbones; the rear keeps a rigid axle.
  suspension: { front: 'double-wishbone', rear: 'solid-axle' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 640 },
  bodyCgFrac: 0.48,
  // Real separate masses the generic body model would otherwise put at mid-body height.
  extraMasses: [
    {
      id: 'ladder-frame',
      label: 'Ladder frame',
      kg: 250,
      posMm: [-1450, 500, 0],
      sizeMm: [4400, 180, 900],
    },
    {
      id: 'axle-rear',
      label: 'Rear axle beam',
      kg: 90,
      posMm: [-2890, 392, 0],
      sizeMm: [300, 200, 1400],
    },
    { id: 'spare-wheel', label: 'Spare wheel (on the tailgate)', kg: 40, posMm: [-4050, 950, 0] },
  ],
  blurb:
    'A body on a ladder frame, a rigid rear axle and three locking differentials: built for terrain, not corners.',
  published: {
    curbKg: 2560,
    frontPct: 52,
    source:
      'G 63: M177 V8 430 kW (585 PS) / 850 Nm with a 48 V starter-generator, modelled as a plain ICE; wb 2890, 4873 × 1984 × 1966 mm, 275/50 R20 — encycarpedia / autocentrum.pl (W465) and MBUSA; 40:60 permanent split — MBUSA G 63 specifications; 2560 kg DIN (2018–24 G 63, 2565 kg 2024 per encycarpedia); tracks 1650/1654 — autotijd.be (2018–24 G 63); ~ overhang measured on the 2025 G 63 model; ~ frame/axle masses and ~ 52/48 split estimated',
  },
};

export default v;
