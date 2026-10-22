import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'toyota-fortuner-an160',
  name: 'Toyota Fortuner 2.8 4x4 (AN160)',
  archetype: 'offroader',
  examples: [
    'Toyota Hilux (same IMV ladder frame)',
    'Ford Everest',
    'Mitsubishi Pajero Sport',
    'Isuzu MU-X',
  ],
  years: '2015–',
  dims: {
    wheelbaseMm: 2745,
    trackFMm: 1545,
    trackRMm: 1555,
    lengthMm: 4795,
    widthMm: 1855,
    heightMm: 1835,
    overhangFMm: 1000,
  },
  // 265/60 R18
  // ~ μ (lateral peak) 0.82, set so the sim's 100–0 km/h stop matches: ~45 m from 100 km/h (a 3.3 s
  // stop reported in India ≈ 46 m); no distance found
  // ~ kind: OE highway-terrain
  tires: { widthFMm: 265, widthRMm: 265, diameterMm: 775, mu: 0.82, kind: 'road' },
  body: {
    style: 'suv',
    tail: 'hatch',
    bonnetHMm: 1230,
    beltHMm: 1280,
    cowlXMm: -700,
    roofFrontXMm: -1150,
    roofRearXMm: -3550,
    tailHMm: 1700,
    paint: '#e6e6e3',
  },
  bay: { widthMm: 1150, lengthMm: 950 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-1gd-ftv',
    // Pickup packaging: the diesel sits behind the front axle, the front diff beside its sump.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -230,
    crankYMm: 600,
    gearbox: 'inline',
    gearboxKg: 85,
    driven: 'all',
    // Part-time 4WD: normally rear drive (H2). H4 and L4 lock the front prop shaft to the rear
    // through the transfer case (no centre diff); L4 adds the low range.
    awd: 'transfer-case',
    frontTorqueShare: 0.5,
    awdDevice: { type: 'locked' },
    fuelTank: { litres: 80, xMm: -2150 },
  },
  chassis: 'ladder-frame',
  suspension: { front: 'double-wishbone', rear: 'solid-axle' },
  seats: { layout: '7', rows: 3 },
  luggageL: { rear: 296 },
  bodyCgFrac: 0.48,
  extraMasses: [
    {
      id: 'ladder-frame',
      label: 'Ladder frame',
      kg: 230,
      posMm: [-1350, 480, 0],
      sizeMm: [4500, 180, 900],
    },
    {
      id: 'axle-rear',
      label: 'Rear axle beam',
      kg: 85,
      posMm: [-2745, 388, 0],
      sizeMm: [300, 200, 1350],
    },
    { id: 'spare-wheel', label: 'Spare wheel (under the floor)', kg: 35, posMm: [-3400, 350, 0] },
  ],
  blurb:
    'A pickup’s ladder frame and live rear axle under a seven-seat body: tough and tall, with the CG to match.',
  published: {
    curbKg: 2135,
    frontPct: 52,
    source:
      '4795 × 1855 × 1835 mm, wheelbase 2745, tread 1545/1555, 265/60 R18, 80 L, kerb 2080–2125 kg (2.8 AT) — Toyota Brunei spec sheet; part-time 4WD (H2/H4/L4) — Toyota IMC (Sigma 4); Neo Drive adds a 48 V belt starter-generator (~10 kg, evoIndia), modelled here as a plain ICE; ~ kerb 2135 kg, ~ overhang 1000 measured on the Ddiaz model (to scale: 2748 mm wheelbase, 4.8 m long); ~ 52/48 split, frame/axle masses and engine position estimated',
  },
};

export default v;
