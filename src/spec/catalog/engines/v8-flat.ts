import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-flat',
  name: 'Flat-plane V8',
  layoutLabel: '90° V8, flat-plane (180°) crank',
  examples: ['Ferrari F136 (458 Italia)', 'Chevrolet LT6 (Corvette Z06)', 'Ford Voodoo (GT350)'],
  boreMm: 94,
  strokeMm: 81,
  rodMm: 138,
  borePitchMm: 104,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 3, 7, 4, 8, 2, 6],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 900,
  redlineRpm: 9000,
  massKg: 190,
  powerKw: 425,
  torqueNm: 540,
  geometry: { drySump: true },
  sound: sound({
    character: 'shriek',
    collector: 'per-bank',
    headerMm: 520,
    // dull and firing-dominant: a steep, tight silencer and a big-bore pipe that still radiates
    // the low firing line, fitted to Ferrari 458 Italia, Commons "Ferrari_458_Italia.ogg"
    // (Edvvc, CC BY-SA 3.0; audio/test/real.ts)
    muffler: { cutoffHz: 380, leak: 0.15, poles: 2, lowHz: 60 },
  }),
  notes:
    'Two inline-4s on one crank: even firing per bank (shriek) and a light crank that revs fast, at the cost of a 2nd-order horizontal shake.',
  source: '~ F136 FB: bore/stroke Ferrari; rod, pitch and mass estimated',
});
