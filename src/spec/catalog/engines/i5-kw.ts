import { inline, sound } from '../../builders';

export default inline(5, {
  id: 'i5-kw',
  name: 'Inline-5 2.1 turbo, 20-valve',
  layoutLabel: 'Inline-5, 72° crank, DOHC',
  examples: ['Audi KW (Sport quattro, 1984–85)', 'Audi S1 / S1 E2 rally engines (same block)'],
  boreMm: 79.3,
  strokeMm: 86.4,
  rodMm: 136,
  borePitchMm: 88,
  firingOrder: [1, 2, 4, 5, 3],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 900,
  redlineRpm: 7000,
  // The all-aluminium block is ~24 kg lighter than the Quattro's iron one.
  massKg: 145,
  powerKw: 225,
  torqueNm: 350,
  sound: sound({
    character: 'warble',
    headerMm: 450,
    // The Group B S1 cars kept the turbo spinning off-throttle; the road car did not.
    turbo: { count: 1, spoolRpm: 3500, maxShaftKrpm: 130, bov: true, antiLag: true },
  }),
  notes:
    'The Quattro’s five with an aluminium block and a 20-valve twin-cam head, hung longitudinally ahead of the front axle.',
  source:
    'Sport quattro: all-aluminium 2133 cc, 79.3 × 86.4 mm, DOHC 4 valves/cyl, KKK K27 turbo, 225 kW (306 PS) at 6700 rpm / 350 Nm at 3700 rpm — Wikipedia "Audi Quattro" and "Audi Sport quattro" (de); ~ rod, redline, mass (alloy block saves ~24 kg, ~51 lb per supercars.net) and turbo sound estimated',
});
