import { inline, sound } from '../../builders';

export default inline(3, {
  id: 'i3-city',
  name: 'Inline-3 small turbo',
  layoutLabel: 'Inline-3, 120° crank',
  examples: ['Renault H4Bt 0.9 TCe (Smart ForTwo, Twingo)', 'VW EA211 1.0 TSI'],
  boreMm: 72.2,
  strokeMm: 73.1,
  rodMm: 128,
  borePitchMm: 80,
  firingOrder: [1, 2, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 6200,
  massKg: 80,
  powerKw: 66,
  torqueNm: 135,
  sound: sound({
    character: 'thrum',
    mix: { exhaust: 0.6, intake: 0.3, mechanical: 0.35 },
    turbo: { count: 1, spoolRpm: 2000, maxShaftKrpm: 240, bov: false, antiLag: false },
  }),
  source: '~ H4Bt bore/stroke Renault; rod, pitch and mass estimated',
});
