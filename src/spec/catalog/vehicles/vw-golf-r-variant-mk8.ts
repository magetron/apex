import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'vw-golf-r-variant-mk8',
  name: 'VW Golf R Variant (Mk8)',
  archetype: 'hot-hatch',
  examples: ['VW Golf R (Mk8)', 'Cupra Leon Sportstourer VZ 4Drive', 'Škoda Octavia Combi RS 4x4'],
  dims: {
    wheelbaseMm: 2678,
    trackFMm: 1539,
    trackRMm: 1514,
    lengthMm: 4651,
    widthMm: 1789,
    heightMm: 1466,
    overhangFMm: 880,
  },
  // 235/35 R19
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 647, mu: 1.0 },
  body: {
    style: 'estate',
    tail: 'hatch',
    bonnetHMm: 950,
    beltHMm: 980,
    cowlXMm: -250,
    roofFrontXMm: -1000,
    roofRearXMm: -3150,
    tailHMm: 1100,
    paint: '#2b3a55',
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
    // The Golf R's rear drive unit: two clutch packs, up to half the torque rearward and
    // split between the rear wheels.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.8,
    fuelTank: { litres: 55, xMm: -2100 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 611 },
  bodyCgFrac: 0.47,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 12,
      posMm: [-1330, 300, 0],
      sizeMm: [2250, 80, 80],
    },
  ],
  blurb: 'The Golf R’s driveline under an estate body: the longer tail carries the extra weight.',
  published: {
    curbKg: 1621,
    frontPct: 58,
    source:
      '4644 × 1789 × 1466 mm (4651 mm from the 2024 facelift), wb 2678 — VW Newsroom R-models data; tracks 1539/1514, 235/35 R19 — auto motor und sport test 12/2021; 2025 car 245 kW (333 PS) / 420 Nm, kerb 1621 kg, 55 L — angurten.de; engine and driveline as the Golf R (Mk8); ~ 58/42 split estimated (hatch ~59 plus a longer tail)',
  },
};

export default v;
