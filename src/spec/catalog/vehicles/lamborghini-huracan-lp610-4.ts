import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'lamborghini-huracan-lp610-4',
  name: 'Lamborghini Huracán LP 610-4',
  archetype: 'supercar',
  examples: ['Audi R8 V10 (Type 4S, shared platform)', 'Lamborghini Gallardo', 'Huracán EVO'],
  years: '2014–2019',
  dims: {
    wheelbaseMm: 2620,
    trackFMm: 1668,
    trackRMm: 1620,
    lengthMm: 4459,
    widthMm: 1924,
    heightMm: 1165,
    // ~ the scaled model measures 1105 with Mansory’s longer nose (+82 mm overall)
    overhangFMm: 1025,
  },
  // 245/30 R20 front, 305/30 R20 rear
  // μ (lateral peak) 1.01, set so the sim's lateral limit matches: skidpad 1.01 g, 300 ft — Car and
  // Driver, 2015 (quoted on a forum)
  // ~ kind: OE Pirelli P Zero
  tires: { widthFMm: 245, widthRMm: 305, diameterMm: 672, mu: 1.01, kind: 'performance' },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 740,
    beltHMm: 830,
    cowlXMm: -300,
    roofFrontXMm: -950,
    roofRearXMm: -1650,
    tailHMm: 1020,
    paint: '#9bc21c',
  },
  bay: { widthMm: 1300, lengthMm: 1100 },
  powertrain: {
    kind: 'ice',
    engine: 'v10',
    // The R8's recipe: a dry-sump V10 ahead of the rear axle, the 7-speed twin-clutch transaxle
    // behind it, and a prop shaft forward to a clutch-controlled front differential.
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -2030,
    crankYMm: 350,
    gearbox: 'mid-transaxle',
    gearboxKg: 140,
    driven: 'all',
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.3,
    fuelTank: { litres: 80, xMm: -250 },
  },
  // Hybrid aluminium + carbon-fibre frame.
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'double-wishbone' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 100 },
  bodyCgFrac: 0.54,
  blurb:
    'A mid-engined V10 whose front wheels are driven only when the clutch at the front axle closes.',
  published: {
    curbKg: 1553,
    frontPct: 42,
    source:
      'Wheelbase 2620, track 1668/1620, dry 1422 kg, 42/58 split — Lamborghini launch data via lambocars.com; 4459 × 1924 × 1165 mm, kerb 1553 kg with fluids, 449 kW / 560 Nm — Wikipedia "Lamborghini Huracán"; ~30/70 nominal torque split, up to 50% front (Haldex-type clutch) — launch reviews (AutoGuide, 2014); ~ tank, overhang and engine position estimated',
  },
};

export default v;
