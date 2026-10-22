import { sound, vee } from '../../builders';

export default vee(6, 60, {
  id: 'v6-60',
  name: '60° V6',
  layoutLabel: '60° V6, split-pin crank',
  examples: ['Nissan VQ37VHR (370Z)', 'Alfa Romeo Busso', 'Toyota 2GR'],
  boreMm: 95.5,
  strokeMm: 86,
  rodMm: 144.2,
  borePitchMm: 108,
  numbering: 'alternating',
  firstBank: 'right',
  pins: 'split',
  firingOrder: [1, 2, 3, 4, 5, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 700,
  redlineRpm: 7500,
  massKg: 165,
  powerKw: 245,
  torqueNm: 363,
  sound: sound({
    character: 'howl',
    collector: 'per-bank',
    // light on the lows: fitted to a Nissan VQ35HR idling, Commons "NISSAN_VQ35HR_engine.ogg"
    // (TTTNIS, public domain; audio/test/real.ts), as far as full load stays 20 dB under the comb
    muffler: { cutoffHz: 600, leak: 0.45, lowHz: 600 },
  }),
  notes:
    'Compact enough to mount transversely (many FWD saloons) — the classic answer to "six in a front-drive car".',
  source: '~ VQ37VHR: bore/stroke/rod Nissan; pitch and mass estimated',
});
