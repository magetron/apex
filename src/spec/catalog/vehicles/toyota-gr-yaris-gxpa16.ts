import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'toyota-gr-yaris-gxpa16',
  name: 'Toyota GR Yaris (GXPA16)',
  archetype: 'hot-hatch',
  examples: [
    'Toyota GR Corolla (same GR-Four driveline)',
    'Ford Focus RS (Mk3)',
    'VW Golf R (Mk8)',
  ],
  dims: {
    wheelbaseMm: 2560,
    trackFMm: 1535,
    trackRMm: 1565,
    lengthMm: 3995,
    widthMm: 1805,
    heightMm: 1455,
    overhangFMm: 830,
  },
  // 225/40 ZR18 on BBS forged 8J wheels
  // μ (lateral peak) 1.03, set so the sim's 100–0 km/h stop matches: 100–0 km/h 35.0 m cold / 33.5
  // m warm — Auto Bild (facelift)
  // ~ kind: OE Michelin Pilot Sport 4S / Dunlop SP Sport Maxx 050
  tires: { widthFMm: 225, widthRMm: 225, diameterMm: 637, mu: 1.03, kind: 'performance' },
  body: {
    style: 'hatch',
    tail: 'hatch',
    bonnetHMm: 980,
    beltHMm: 990,
    cowlXMm: -220,
    roofFrontXMm: -950,
    roofRearXMm: -2400,
    tailHMm: 1060,
    paint: '#c4161c',
  },
  bay: { widthMm: 1150, lengthMm: 700 },
  powertrain: {
    kind: 'ice',
    engine: 'i3',
    // The three-cylinder is short across the car, so the whole unit sits low and pushed back
    // toward the bulkhead to take weight off the nose.
    position: 'front-overhang',
    orientation: 'transverse',
    engineXMm: 140,
    crankYMm: 400,
    gearbox: 'transverse-endon',
    gearboxSide: 'left',
    gearboxKg: 75,
    driven: 'all',
    // GR-Four: no centre diff; an electronically controlled multi-plate clutch ahead of the
    // rear diff sets the split — 60:40 Normal, 30:70 Sport, 50:50 Track.
    awd: 'clutch-on-demand',
    frontTorqueShare: 0.6,
    awdDevice: { type: 'clutch', name: 'GR-Four', frontRange: [0, 1] },
    fuelTank: { litres: 50, xMm: -1900 },
  },
  chassis: 'monocoque',
  suspension: { front: 'macpherson', rear: 'double-wishbone' },
  seats: { layout: '4', rows: 2 },
  luggageL: { rear: 174 },
  bodyCgFrac: 0.44,
  extraMasses: [
    { id: 'transfer', label: 'Transfer (power take-off)', kg: 15, posMm: [-80, 320, -120] },
    {
      id: 'prop-shaft',
      label: 'Prop shaft',
      kg: 11,
      posMm: [-1250, 300, 0],
      sizeMm: [2100, 80, 80],
    },
    // Moved to the boot floor for weight distribution.
    { id: 'battery', label: '12 V battery (boot)', kg: 14, posMm: [-2850, 330, 350] },
  ],
  blurb:
    'A rally homologation special: a three-cylinder turbo across the nose and a rear clutch that can send most of the torque backwards.',
  published: {
    curbKg: 1280,
    frontPct: 60,
    source:
      'Dims 3995 × 1805 × 1455 mm, wb 2560, tracks 1535/1565, 225/40 ZR18, 50 L tank, kerb 1280–1305 kg (6MT) — Toyota UK GR Yaris technical specifications; GR-Four splits 60:40 / 30:70 / 50:50, theoretical range 100:0 to 0:100 (rear geared slightly faster) — Toyota launch release (toyota.co.nz, Jan 2020); ~ 60/40 weight split (Motor Matchup spec listing, unverified); front overhang 830 mm (autotijd.be, matches the 3D model); ~ engine position estimated',
  },
};

export default v;
