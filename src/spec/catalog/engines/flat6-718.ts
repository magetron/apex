import { flat, sound } from '../../builders';

export default flat(6, {
  id: 'flat6-718',
  name: 'Flat-6 4.0 naturally aspirated',
  layoutLabel: 'Horizontally opposed 6',
  examples: ['Porsche 4.0 (718 Cayman/Boxster GTS 4.0, Spyder, GT4)', 'Porsche 9A2 Evo family'],
  boreMm: 102,
  strokeMm: 81.5,
  rodMm: 127,
  borePitchMm: 118,
  numbering: 'bank-sequential',
  firstBank: 'right',
  firingOrder: [1, 6, 2, 4, 3, 5],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 800,
  redlineRpm: 7800,
  massKg: 190,
  powerKw: 294,
  torqueNm: 420,
  geometry: { drySump: true },
  sound: sound({
    character: 'howl',
    collector: 'per-bank',
    headerMm: 560,
    // a freer-flowing sports silencer, light on the lows: fitted to a Porsche Cayman S (3.4
    // flat-6), Commons "2006_Porsche_Cayman_S_engine_sound.wav" (John64, CC BY-SA 3.0;
    // audio/test/real.ts), as far as full load stays 20 dB under the comb
    muffler: { cutoffHz: 600, leak: 0.6, lowHz: 600 },
  }),
  notes:
    'The same flat-6 family as the 911, turned round and moved ahead of the rear axle: the gearbox now sits behind it.',
  source:
    '718 GTS 4.0: 102 × 81.5 mm, 3995 cc, 294 kW (400 PS) / 420 Nm, 7800 rpm — Porsche press data (2020); ~ rod, pitch (as 9A2) and mass estimated',
});
