import { sound, vee } from '../../builders';

export default vee(6, 90, {
  id: 'v6-ea837',
  name: '90° V6 supercharged, 3.0 TFSI',
  layoutLabel: '90° V6, split pins (even fire), Roots supercharger in the vee',
  examples: [
    'Audi 3.0 TFSI EA837 (S4/S5 B8, A6/A7 C7, Q7)',
    'Audi 3.0 TFSI (Porsche Cayenne S E-Hybrid, VW Touareg Hybrid)',
  ],
  boreMm: 84.5,
  strokeMm: 89,
  rodMm: 154,
  borePitchMm: 90,
  // Audi counts 1–3 down the right bank, 4–6 down the left.
  numbering: 'bank-sequential',
  firstBank: 'right',
  // A 90° vee wants 120° for even firing, so each pair of crank pins is split by 30°.
  pins: 'split',
  firingOrder: [1, 4, 3, 6, 2, 5],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'supercharged',
  idleRpm: 650,
  redlineRpm: 6800,
  massKg: 190,
  powerKw: 245,
  torqueNm: 440,
  sound: sound({
    character: 'howl',
    collector: 'per-bank',
    headerMm: 450,
  }),
  notes:
    'The supercharger and its intercoolers fill the vee, so the engine is barely taller than an atmospheric V6 and the intake path is short.',
  source:
    'EA837 3.0 TFSI: 84.5 × 89 mm, 2995 cc, Roots-type supercharger; S4 (B8) 245 kW (333 PS) / 440 Nm — Audi via fichacompleta.com.br and Euro Premium Parts EA837 guide; ~ rod, 90 mm bore pitch (Audi V6/V8 family) and 190 kg installed mass estimated',
});
