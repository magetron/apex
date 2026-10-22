import { inline, sound } from '../../builders';

export default inline(5, {
  id: 'i5',
  name: 'Inline-5 turbo',
  layoutLabel: 'Inline-5, 72° crank',
  examples: ['Audi 2.5 TFSI (RS3, TT RS)', 'Volvo T5', 'Audi Quattro (1980s)'],
  boreMm: 82.5,
  strokeMm: 92.8,
  rodMm: 144,
  borePitchMm: 88,
  firingOrder: [1, 2, 4, 5, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 750,
  redlineRpm: 7000,
  massKg: 160,
  powerKw: 294,
  torqueNm: 500,
  sound: sound({
    character: 'warble',
    turbo: { count: 1, spoolRpm: 2200, maxShaftKrpm: 190, bov: true, antiLag: false },
  }),
  notes: 'Odd 144° firing interval gives the famous warble; mounted transversely in the RS3.',
  source: '~ Audi DAZA: bore/stroke/pitch Audi; rod and mass estimated',
});
