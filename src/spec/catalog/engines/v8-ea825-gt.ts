import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-ea825-gt',
  name: 'V8 4.0 twin-turbo, hot-vee (RS 6 GT)',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: ['VW Group 4.0 TFSI EA825 (Audi RS 6 Avant GT, RS 6/RS 7 performance C8)'],
  boreMm: 86,
  strokeMm: 86,
  rodMm: 150,
  borePitchMm: 90,
  // Audi counts 1–4 down the right bank, 5–8 down the left.
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 8, 6, 3, 7, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 650,
  redlineRpm: 6800,
  massKg: 225,
  powerKw: 463,
  torqueNm: 850,
  sound: sound({
    character: 'burble',
    // Both twin-scroll turbos sit in the vee, one per bank.
    collector: 'per-bank',
    headerMm: 300,
    turbo: { count: 2, spoolRpm: 1800, maxShaftKrpm: 190, bov: true, antiLag: false },
  }),
  notes:
    'Turbos in the vee keep the exhaust path short and the engine narrow. Audi pairs it with a 48 V starter-generator and cylinder deactivation; Porsche builds the same engine in Zuffenhausen.',
  source:
    'The RS 6 Avant GT tune of v8-ea825 (same geometry and sound): 463 kW (630 PS) / 850 Nm — ADAC Autokatalog, auto-zeitung.de; EA825 86 × 86 mm, 3996 cc — Audi MediaCenter; Audi V8 firing order 1-5-4-8-6-3-7-2; ~ rod, 90 mm bore pitch and 225 kg installed mass estimated',
});
