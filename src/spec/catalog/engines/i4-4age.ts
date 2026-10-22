import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-4age',
  name: 'Inline-4 16-valve, high-revving',
  layoutLabel: 'Inline-4, flat (180°) crank, twin-cam',
  examples: ['Toyota 4A-GE (AE86, AW11 MR2)', 'Toyota 3S-GE'],
  boreMm: 81,
  strokeMm: 77,
  rodMm: 105.5,
  borePitchMm: 87.5,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 850,
  redlineRpm: 7600,
  massKg: 115,
  powerKw: 96,
  torqueNm: 149,
  sound: sound({
    character: 'shriek',
    headerMm: 700,
    mix: { exhaust: 0.7, intake: 0.5, mechanical: 0.25 },
  }),
  notes:
    'Over-square bore and short stroke let it rev; the same engine went in the front of the AE86 and the middle of the first MR2.',
  source:
    '4A-GE: 81 × 77 mm, 1587 cc; JDM 130 PS (96 kW) / 149 Nm gross — Toyota via Wikipedia "Toyota A engine", "Toyota AE86"; ~ rod, pitch and mass estimated',
});
