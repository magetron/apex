import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-s14',
  name: 'Inline-4 2.3 motorsport 16-valve',
  layoutLabel: 'Inline-4, flat (180°) crank, twin-cam',
  examples: ['BMW S14 (E30 M3 Evolution II)', 'BMW S14 (E30 M3, 143–158 kW)'],
  boreMm: 93.4,
  strokeMm: 84,
  rodMm: 144,
  borePitchMm: 100,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'na',
  idleRpm: 900,
  redlineRpm: 7250,
  massKg: 150,
  powerKw: 162,
  torqueNm: 245,
  sound: sound({
    character: 'shriek',
    headerMm: 720,
    mix: { exhaust: 0.75, intake: 0.5, mechanical: 0.25 },
  }),
  notes:
    'An M10 iron block with a four-valve head derived from the M88 six: a homologation engine for touring-car racing.',
  source:
    'S14B23: 93.4 × 84 mm, 2302 cc, 100 mm bore pitch (M10 block), 143 kW (195 PS, catalysed) / 230 Nm in the regular M3 — BMW via Wikipedia "BMW S14"; Evolution II 162 kW (220 PS) at 6750 rpm / 245 Nm at 4750 rpm — Wikipedia "BMW M3"; ~ rod and mass estimated',
});
