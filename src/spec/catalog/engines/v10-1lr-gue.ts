import { sound, vee } from '../../builders';

export default vee(10, 72, {
  id: 'v10-1lr-gue',
  name: 'V10 (72°)',
  layoutLabel: '72° V10, shared pins (even fire)',
  examples: ['Lexus 1LR-GUE (LFA)'],
  boreMm: 88,
  strokeMm: 79,
  rodMm: 138,
  borePitchMm: 98,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 6, 5, 10, 2, 7, 3, 8, 4, 9],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 1000,
  redlineRpm: 9000,
  massKg: 200,
  powerKw: 412,
  torqueNm: 480,
  geometry: { drySump: true },
  sound: sound({ character: 'howl', collector: 'per-bank', headerMm: 560 }),
  notes:
    '72° is 720°/10, so the banks fire evenly on shared crank pins — no split pins as a 90° V10 needs.',
  source:
    '1LR-GUE: 88.0 × 79.0 mm, 4805 cc, 412 kW (560 PS) at 8700 rpm / 480 Nm, 9000 rpm redline, dry sump — Toyota LFA main specifications (2009) and Wikipedia "Lexus LFA"; ~ rod, pitch, idle and mass estimated (Lexus: V8-sized, V6-weight)',
});
