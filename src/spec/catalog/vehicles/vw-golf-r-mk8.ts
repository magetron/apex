import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-golf-r-mk8',
  name: 'VW Golf R (Mk8)',
  archetype: 'hot-hatch',
  examples: ['Audi S3 (8Y)', 'Cupra Leon 4Drive', 'Mercedes-AMG A 35 4MATIC'],
  dims: {
    wheelbaseMm: 2636,
    trackFMm: 1543,
    trackRMm: 1514,
    lengthMm: 4290,
    widthMm: 1789,
    heightMm: 1458,
    overhangFMm: 880,
  },
  // 235/35 R19
  // μ (lateral peak) 1.05, set so the sim's 100–0 km/h stop matches: 100–0 km/h 35.2 m (11.0 m/s²)
  // — auto motor und sport / sport auto Nordschleife test
  // ~ kind: OE 19-inch summer
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 647, mu: 1.05, kind: 'performance' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 945,
    beltHMm: 995,
    cowlXMm: -170,
    roofFrontXMm: -1000,
    roofRearXMm: -2550,
    tailHMm: 1140,
    paint: '#1f5fbf',
  },
  bay: { widthMm: 1080, lengthMm: 650 },
  powertrain: {
    kind: 'ice',
    engine: 'i4-ea888-evo4-facelift',
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 180,
    crankYMm: 420,
    engineTiltDeg: 12,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 80,
    driven: 'all',
    // Mk8: a rear drive unit with two clutch packs can send up to half the torque rearward.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.8,
    awdDevice: { type: 'clutch', name: '4MOTION', frontRange: [0.5, 1] },
    fuelTank: { litres: 55, xMm: -2050 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 374 },
  bodyCgFrac: 0.455,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1300, 300, 0],
      sizeMm: [2200, 80, 80],
    },
  ],
  blurb:
    'The GTI’s body and engine bay with a prop shaft and a clutch-controlled rear drive unit added.',
  published: {
    curbKg: 1551,
    frontPct: 59,
    source:
      'Kerb 1551 kg (DSG) — VW via Motor1 (Mk8 vs Mk7.5), FIA Group 3E form lists 1556 kg tare; 4MOTION sends up to 50 % to the rear axle (VW US press release via Automotive World; Jalopnik on the Mk8), ~ 80:20 preload estimated; dims as Golf Mk8 (Wikipedia), ~ R-specific height/tracks; ~ 59/41 split estimated: GTI plus ~100 kg of AWD hardware aft of the front axle',
  },
};

export default v;
