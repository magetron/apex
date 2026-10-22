import { sound, vee } from '../../builders';

export default vee(6, 60, {
  id: 'v6-vr38',
  name: '60° V6 twin-turbo',
  layoutLabel: '60° V6, split-pin crank',
  examples: ['Nissan VR38DETT (GT-R R35)'],
  boreMm: 95.5,
  strokeMm: 88.4,
  rodMm: 165,
  borePitchMm: 108,
  numbering: 'alternating',
  firstBank: 'right',
  pins: 'split',
  firingOrder: [1, 2, 3, 4, 5, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 750,
  redlineRpm: 7100,
  massKg: 250,
  powerKw: 419,
  torqueNm: 637,
  sound: sound({
    character: 'whoosh',
    collector: 'per-bank',
    headerMm: 380,
    turbo: { count: 2, spoolRpm: 2800, maxShaftKrpm: 190, bov: true, antiLag: false },
  }),
  notes:
    'Despite the name it is a conventional 60° vee with two heads — "VR" is Nissan’s engine-family code, not a VW-style narrow-angle VR.',
  source:
    'VR38DETT: 95.5 × 88.4 mm, 3799 cc; 419 kW (570 PS) / 637 Nm from MY2017 — Nissan press data via Wikipedia "Nissan VR38DETT engine"; ~ rod, pitch and mass estimated',
});
