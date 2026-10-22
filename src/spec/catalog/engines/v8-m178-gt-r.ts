import { sound, vee } from '../../builders';

export default vee(8, 90, {
  id: 'v8-m178-gt-r',
  name: 'Cross-plane V8 twin-turbo, dry sump (GT R)',
  layoutLabel: '90° V8, cross-plane crank, turbos in the vee, dry sump',
  examples: ['Mercedes-AMG M178 (AMG GT R, GT R Pro C190)'],
  boreMm: 83,
  strokeMm: 92,
  rodMm: 150,
  borePitchMm: 106,
  numbering: 'bank-sequential',
  firstBank: 'right',
  pins: 'shared',
  firingOrder: [1, 5, 4, 2, 6, 3, 7, 8],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'twin-turbo',
  idleRpm: 700,
  redlineRpm: 7200,
  massKg: 209,
  powerKw: 430,
  torqueNm: 700,
  // The dry sump lets AMG mount the engine 55 mm lower than a wet-sump M177 would sit.
  geometry: { drySump: true },
  sound: sound({
    character: 'burble',
    collector: 'per-bank',
    headerMm: 320,
    turbo: { count: 2, spoolRpm: 1750, maxShaftKrpm: 190, bov: true, antiLag: false },
  }),
  notes:
    'The M177 with a dry sump, so it can sit low and far back behind the front axle of a front-mid GT.',
  source:
    'The GT R tune of v8-m178 (same geometry and sound): 430 kW (585 PS) at 6250 rpm / 700 Nm from 1900 rpm — auto-motor-und-sport.de Supertest (03/2017); 83 × 92 mm, 3982 cc, 209 kg dry, dry sump lowers the engine by 55 mm — Mercedes-AMG press kit (2014); ~ rod and pitch estimated',
});
