import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'tesla-model3-rwd',
  name: 'Tesla Model 3 RWD',
  archetype: 'ev',
  examples: ['BMW i4 eDrive40', 'Polestar 2 (2024, RWD)', 'VW ID.3'],
  dims: {
    wheelbaseMm: 2875,
    trackFMm: 1584,
    trackRMm: 1584,
    lengthMm: 4720,
    widthMm: 1850,
    heightMm: 1441,
    overhangFMm: 840,
  },
  // 235/45 R18
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 668, mu: 1.0 },
  body: {
    style: 'fastback',
    tail: 'notch',
    bonnetHMm: 880,
    beltHMm: 980,
    cowlXMm: -200,
    roofFrontXMm: -1250,
    roofRearXMm: -2700,
    tailHMm: 1050,
    paint: '#4a4d52',
  },
  bay: { widthMm: 1100, lengthMm: 600 },
  powertrain: {
    kind: 'ev',
    motors: [{ motor: 'pmsm-rear', axle: 'rear' }],
    // LFP pack: heavier per kWh than the long-range NCA pack, same floor footprint.
    battery: { kWh: 60, massKg: 430, lengthMm: 2100, widthMm: 1500, heightMm: 140, xMm: -1450 },
    driven: 'rear',
  },
  seats: { layout: '5', rows: 2 },
  luggageL: { front: 88, rear: 594 },
  bodyCgFrac: 0.54,
  blurb: 'One motor at the rear and the battery in the floor: the simplest electric layout.',
  published: {
    curbKg: 1760,
    frontPct: 45,
    source:
      'Kerb 1760 kg (2024 RWD, 60 kWh LFP) — evspecifications.com; ~ pack mass estimated; ~ 45/55 split estimated as the dual-motor car without its ~80 kg front drive unit',
  },
};

export default v;
