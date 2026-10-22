import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-l15c',
  name: 'Inline-4 1.5 VTEC turbo',
  layoutLabel: 'Inline-4, flat (180°) crank',
  examples: ['Honda L15C (Integra China, Civic 11th gen)', 'Honda L15B7 (Civic 10th gen)'],
  boreMm: 73,
  strokeMm: 89.4,
  rodMm: 150,
  borePitchMm: 81,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 700,
  redlineRpm: 6500,
  massKg: 110,
  powerKw: 134,
  torqueNm: 240,
  sound: sound({
    character: 'thrum',
    headerMm: 300,
    turbo: { count: 1, spoolRpm: 1700, maxShaftKrpm: 230, bov: false, antiLag: false },
  }),
  notes:
    'Turned round so the exhaust and turbo face the bulkhead: a short, hot path to the catalyst behind the engine.',
  source:
    'L15C (240 Turbo): 73 × 89.4 mm, 1498 cc, 134 kW (182 PS) at 6000 rpm / 240 Nm at 1700–4500 rpm — GAC Honda via carnewschina.com and wapcar.my, Civic XI data via auto-data.net; ~ rod, bore pitch, red line and mass estimated',
});
