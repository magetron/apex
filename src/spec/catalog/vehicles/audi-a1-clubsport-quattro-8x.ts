import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'audi-a1-clubsport-quattro-8x',
  name: 'Audi A1 clubsport quattro (concept)',
  archetype: 'hot-hatch',
  examples: ['Audi TT RS (8J)', 'Audi RS 3 Sportback (8P)', 'Audi A1 quattro (2012, 2.0 TFSI)'],
  years: '2011 (concept)',
  dims: {
    wheelbaseMm: 2469,
    trackFMm: 1490,
    trackRMm: 1490,
    lengthMm: 3990,
    widthMm: 1800,
    heightMm: 1415,
    overhangFMm: 830,
  },
  // 255/30 R19
  // ~ μ (lateral peak) 1.02, set so the sim's 100–0 km/h stop matches: ~35 m from 100 km/h, as a GR
  // Yaris or Golf R; a concept, never tested
  // ~ kind: concept, 19-inch summer tyres
  tires: { widthFMm: 255, widthRMm: 255, diameterMm: 636, mu: 1.02, kind: 'performance' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 960,
    beltHMm: 985,
    cowlXMm: -200,
    roofFrontXMm: -850,
    roofRearXMm: -2600,
    tailHMm: 975,
    paint: '#e8e8e6',
  },
  bay: { widthMm: 1250, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i5',
    // A five-cylinder across a supermini nose: its length, plus the gearbox, spans the bay.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 190,
    crankYMm: 420,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 90,
    driven: 'all',
    // The TT RS's Haldex clutch, ahead of the rear diff.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.85,
    fuelTank: { litres: 45, xMm: -1900 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { rear: 270 },
  bodyCgFrac: 0.47,
  extraMasses: [
    { id: 'ptu', label: 'Angle drive (power take-off)', kg: 15, posMm: [-80, 330, -150] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 11,
      posMm: [-1200, 300, 0],
      sizeMm: [2000, 80, 80],
    },
    // A lightweight racing battery under the rear storage compartments.
    { id: 'battery', label: 'Racing battery (rear)', kg: 8, posMm: [-2300, 300, 0] },
  ],
  blurb: 'A show car that crams the TT RS five-cylinder and quattro driveline into a supermini.',
  published: {
    curbKg: 1390,
    frontPct: 60,
    source:
      'Concept (Wörthersee 2011, not built for sale): 2.5 TFSI 370 kW / 660 Nm, 6-speed manual, quattro from the TT RS, 255/30 R19, battery at the rear, body widened 60 mm, 1390 kg — Audi via supercars.net and Motor Authority; wb 2469 mm as A1 (8X); ~ tracks, length, height and overhang measured on the 3D model; ~ 60/40 split estimated',
  },
};

export default v;
