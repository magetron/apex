import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-m177-g63',
  name: 'Cross-plane V8 twin-turbo, hot-vee (G 63)',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: ['Mercedes-AMG M177 (G 63 W465, 2024–)', 'Mercedes-AMG M177 (G 63 W463, 2018–24)'],
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
  powerKw: 430,
  torqueNm: 850,
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
    'The G 63 tune of v8-m177 (same geometry and sound): 430 kW (585 PS) / 850 Nm — encycarpedia / autocentrum.pl (W465) and MBUSA; 83 × 92 mm, 3982 cc, firing order 1-5-4-2-6-3-7-8 — Mercedes-AMG press data (2014–15); its 48 V starter-generator is left out; 209 kg as quoted for M178; ~ rod and pitch estimated',
});
