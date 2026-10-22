import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-n63',
  name: 'V8 4.4 twin-turbo, hot-vee',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: ['BMW N63 (750i/750Li G11/G12, X5 50i, M550i)', 'BMW S63 (M5 F90, X5 M)'],
  boreMm: 89,
  strokeMm: 88.3,
  rodMm: 145,
  borePitchMm: 98,
  // BMW counts 1–4 down the right bank, 5–8 down the left.
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 8, 6, 3, 7, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 600,
  redlineRpm: 6500,
  massKg: 230,
  powerKw: 390,
  torqueNm: 750,
  sound: sound({
    character: 'burble',
    // BMW's "reverse-flow" heads put the exhaust ports and both turbos inside the vee.
    collector: 'per-bank',
    headerMm: 300,
    turbo: { count: 2, spoolRpm: 1500, maxShaftKrpm: 180, bov: true, antiLag: false },
  }),
  notes:
    'The first production hot-vee: exhaust ports face into the vee, so the turbos sit on top of the engine and the intake runs down its flanks.',
  source:
    'N63B44 (G12 LCI 750Li xDrive, 2019–22): 89 × 88.3 mm, 4395 cc, 390 kW (530 PS) / 750 Nm, firing order 1-5-4-8-6-3-7-2 — BMW technical data via auto-data.net and BMW USA spec sheets; ~ rod, 98 mm bore pitch and 230 kg installed mass estimated',
});
