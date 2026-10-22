import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4',
  name: 'Inline-4 turbo',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['VW EA888 (Golf GTI/R)', 'Honda K20C1 (Civic Type R)', 'BMW B48'],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  borePitchMm: 88,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 6800,
  massKg: 140,
  powerKw: 180,
  torqueNm: 370,
  sound: sound({
    character: 'thrum',
    turbo: { count: 1, spoolRpm: 1800, maxShaftKrpm: 200, bov: true, antiLag: false },
    // a clean, low silencer, fitted to VW Scirocco R (EA888), Commons "Scirocco_r_0.ogg"
    // (myvolkswagen, public domain; audio/test/real.ts)
    muffler: { cutoffHz: 200, leak: 0.15 },
  }),
  notes:
    'Primary balanced; a 2nd-order vertical shake remains, so larger I4s carry twin balance shafts.',
  source: '~ EA888 Gen3/4: bore/stroke/rod/pitch VW; mass estimated',
});
