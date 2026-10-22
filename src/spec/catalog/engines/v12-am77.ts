import { sound, vee } from '../../builders';

export default vee(12, 60, {
  id: 'v12-am77',
  name: 'V12 7.3, dry sump',
  layoutLabel: '60° V12, dry sump',
  examples: [
    'Aston Martin AM77 7.3 V12 (One-77)',
    'Aston Martin 5.9 V12 (DB9, DBS, V12 Vantage), the same block',
  ],
  boreMm: 94,
  strokeMm: 87.8,
  rodMm: 140,
  // Cosworth kept the 5.9's block and its 102 mm bore centres.
  borePitchMm: 102,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 7500,
  massKg: 260,
  powerKw: 559,
  torqueNm: 750,
  // The dry sump lets the V12 sit 100 mm lower than in any earlier V12 Aston.
  geometry: { drySump: true },
  sound: sound({ character: 'howl', collector: 'per-bank', headerMm: 560 }),
  notes:
    'Two inline-6s on one crank: no free forces or couples. Dry-sumped so it can sit low and well behind the front axle.',
  source:
    'AM77: 7312 cc, 94 × 87.8 mm (bored and stroked from 89 × 79.5), 559 kW (760 PS) / 750 Nm, 260 kg after a 60 kg saving, dry sump 100 mm lower, 102 mm bore centres kept — Aston Martin (astonmartins.com), AutoZine, Cosworth via newatlas; ~ rod, firing order (Aston 5.9 V12 order) and redline estimated',
});
