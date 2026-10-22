import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'ferrari-roma-f169',
  name: 'Ferrari Roma (F169)',
  archetype: 'gt',
  examples: [
    'Ferrari Portofino / California T (same front-mid V8 + rear DCT layout)',
    'Ferrari 812 Superfast (front-mid V12)',
    'Mercedes-AMG GT (C190)',
  ],
  dims: {
    wheelbaseMm: 2670,
    trackFMm: 1652,
    trackRMm: 1679,
    lengthMm: 4656,
    widthMm: 1974,
    heightMm: 1301,
    overhangFMm: 1030,
  },
  // 245/35 ZR20 front, 285/35 ZR20 rear
  // μ (lateral peak) 1.11, set so the sim's 100–0 km/h stop matches: 100–0 km/h 33.2 m — auto motor
  // und sport 09/2022 (via fastestlaps)
  // ~ kind: OE summer
  tires: { widthFMm: 245, widthRMm: 285, diameterMm: 694, mu: 1.11, kind: 'performance' },
  body: {
    style: 'coupe',
    tail: 'fastback',
    bonnetHMm: 880,
    beltHMm: 940,
    cowlXMm: -660,
    roofFrontXMm: -1150,
    roofRearXMm: -2650,
    tailHMm: 960,
    paint: '#b3121b',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-f154',
    // The whole V8 sits behind the front axle, pressed up against the bulkhead.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -380,
    crankYMm: 380,
    // 8-speed dual-clutch (from the SF90) at the rear axle, with the E-Diff.
    gearbox: 'rear-transaxle',
    gearboxKg: 130,
    driven: 'rear',
    fuelTank: { litres: 80, xMm: -2150 },
  },
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2+2', rows: 2 },
  luggageL: { rear: 272 },
  bodyCgFrac: 0.5,
  blurb:
    'A front-mid V8 behind the front axle and the gearbox at the rear: a GT that weighs the same at both ends.',
  published: {
    curbKg: 1570,
    frontPct: 50,
    source:
      'Dims 4656 × 1974 × 1301 mm, wheelbase 2670, tracks 1652/1679, kerb 1570 kg (dry 1472 kg), 80 L tank, 8-speed F1 DCT, 245/35 ZR20 + 285/35 ZR20 — Ferrari Roma technical specifications (press kit, 2019); 50/50 split — Ferrari via Wikipedia "Ferrari Roma"; F154 BH: 86.5 × 82 mm, 3855 cc, 456 kW (620 cv) / 760 Nm, shown with the F8’s F154 spec; ~ overhang from the 3D model',
  },
};

export default v;
