import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-m177',
  name: 'Cross-plane V8 twin-turbo, hot-vee',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: ['Mercedes-AMG M177 (C 63 W205, E 63)', 'Mercedes-AMG M178 (AMG GT, dry sump)'],
  boreMm: 83,
  strokeMm: 92,
  rodMm: 150,
  borePitchMm: 106,
  // Mercedes counts 1–4 down the right bank, 5–8 down the left.
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 2, 6, 3, 7, 8],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 700,
  redlineRpm: 7000,
  massKg: 209,
  powerKw: 375,
  torqueNm: 700,
  sound: sound({
    character: 'burble',
    // Hot-vee: each turbo sits in the vee and takes one bank, so each bank's uneven pulses survive.
    collector: 'per-bank',
    headerMm: 320,
    turbo: { count: 2, spoolRpm: 1750, maxShaftKrpm: 190, bov: true, antiLag: false },
  }),
  notes:
    'Turbos in the vee keep the engine narrow and the exhaust short; the wet sump makes it taller than the dry-sump M178 in the AMG GT.',
  source:
    'M177 (C 63 S): 83 × 92 mm, 3982 cc, 375 kW (510 PS) / 700 Nm; firing order 1-5-4-2-6-3-7-8 — Mercedes-AMG press data (2014–15); 209 kg as quoted for M178; ~ rod and pitch estimated',
});
