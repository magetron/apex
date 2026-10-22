import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'tesla-model3-awd',
  name: 'Tesla Model 3 Long Range AWD',
  archetype: 'ev',
  examples: ['Polestar 2 Dual Motor', 'BMW i4 xDrive'],
  dims: {
    wheelbaseMm: 2875,
    trackFMm: 1584,
    trackRMm: 1584,
    lengthMm: 4720,
    widthMm: 1850,
    heightMm: 1441,
    overhangFMm: 840,
  },
  // μ (lateral peak) 1.02, set so the sim's 100–0 km/h stop matches: 100–0 km/h 35.4 m — ADAC
  // (Model 3 Highland, Maximale Reichweite AWD)
  // ~ kind: OE touring/EV
  tires: { widthFMm: 235, widthRMm: 235, diameterMm: 668, mu: 1.02, kind: 'road' },
  body: {
    style: 'fastback',
    tail: 'notch',
    bonnetHMm: 880,
    beltHMm: 980,
    cowlXMm: -200,
    roofFrontXMm: -1250,
    roofRearXMm: -2700,
    tailHMm: 1050,
    paint: '#a3121e',
  },
  bay: { widthMm: 1100, lengthMm: 600 },
  powertrain: {
    kind: 'ev',
    motors: [
      { motor: 'induction-front', axle: 'front' },
      { motor: 'pmsm-rear', axle: 'rear' },
    ],
    battery: { kWh: 82, massKg: 480, lengthMm: 2100, widthMm: 1500, heightMm: 140, xMm: -1450 },
    driven: 'all',
    awd: 'dual-motor',
    frontTorqueShare: 0.4,
  },
  seats: { layout: '5', rows: 2 },
  luggageL: { front: 88, rear: 594 },
  bodyCgFrac: 0.54,
  blurb: 'A battery for a floor and a motor on each axle: no gearbox, no clutch, no prop shaft.',
  published: {
    curbKg: 1830,
    frontPct: 47.5,
    source:
      '~ Kerb 1830 kg (Long Range AWD; 2024 LR listed at 1823–1828 kg by evspecifications.com); ~ 47.5/52.5 split from press tests, not re-checked; ~ pack 82 kWh / 480 kg is the 2021–23 Long Range pack',
  },
};

export default v;
