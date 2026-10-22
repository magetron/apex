import { sound, vee } from '../../builders';

export default vee(12, 60, {
  id: 'v12-n74',
  name: 'V12 6.6 twin-turbo (N74)',
  layoutLabel: '60° V12, twin-turbo',
  examples: [
    'BMW N74B66 (Rolls-Royce Ghost, Wraith, Dawn, Cullinan 6.75)',
    'BMW N74B60/B66 (760Li F02, M760Li G12)',
  ],
  boreMm: 89,
  strokeMm: 88.3,
  rodMm: 145,
  borePitchMm: 98,
  // BMW counts 1–6 down the right bank, 7–12 down the left.
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 7, 5, 11, 3, 9, 6, 12, 2, 8, 4, 10],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 550,
  redlineRpm: 6000,
  massKg: 280,
  powerKw: 420,
  torqueNm: 780,
  sound: sound({
    character: 'smooth',
    collector: 'per-bank',
    headerMm: 450,
    mix: { exhaust: 0.55, intake: 0.25, mechanical: 0.15 },
    turbo: { count: 2, spoolRpm: 1200, maxShaftKrpm: 160, bov: false, antiLag: false },
  }),
  notes:
    'Two inline-6s on one crank: no free forces or couples. One turbo per bank, tuned for 780 Nm from 1500 rpm rather than revs.',
  source:
    'N74B66 (Dawn): 89 × 88.3 mm, 6592 cc, 420 kW (563 bhp) at 5250 rpm / 780 Nm at 1500 rpm, firing order 1-7-5-11-3-9-6-12-2-8-4-10 — Rolls-Royce data via carexpert.com.au, Top Gear (M760Li) and mymotorlist.com; ~240 kg (N74, unixnerd.co.uk); ~ rod, 98 mm bore pitch (as the N62/N63 family), redline and 280 kg installed with turbos estimated',
});
