import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-ea827',
  name: 'Inline-4 2.0 8-valve',
  layoutLabel: 'Inline-4, flat (180°) crank, single overhead cam',
  examples: ['VW EA827 2.0 8v (Golf Mk3/Mk4, Jetta, New Beetle)', 'Audi 2.0 (80, A4 B5)'],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  borePitchMm: 88,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'sohc', valvesPerCyl: 2 },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 6200,
  massKg: 130,
  powerKw: 85,
  torqueNm: 170,
  sound: sound({ character: 'thrum', mix: { exhaust: 0.65, intake: 0.35, mechanical: 0.3 } }),
  notes:
    'An iron-block, belt-driven single-cam four: long stroke for low-rev torque, the same bore and stroke the later EA888 turbo kept.',
  source:
    'EA827 2.0 (AEG/APK, New Beetle 1998): 82.5 × 92.8 mm, 1984 cc, SOHC 8 valves, 116 PS (85 kW) at 5200 rpm / 170 Nm at 2400 rpm — Wikipedia "Volkswagen New Beetle"; ~ rod, pitch, redline and mass estimated',
});
