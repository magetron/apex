import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-ea825',
  name: 'V8 4.0 twin-turbo, hot-vee',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee',
  examples: [
    'VW Group 4.0 TFSI EA825 (Audi RS 6/RS 7 C8, Porsche Panamera Turbo 971)',
    'Lamborghini Urus',
    'Bentley Bentayga V8',
  ],
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
  powerKw: 441,
  torqueNm: 800,
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
    'EA825: 86 × 86 mm, 3996 cc; RS 6/RS 7 (C8) 441 kW (600 PS) / 800 Nm — Audi MediaCenter; Panamera Turbo (971) 404 kW / 770 Nm — Porsche; Audi V8 firing order 1-5-4-8-6-3-7-2; ~ rod, 90 mm bore pitch and 225 kg installed mass estimated',
});
