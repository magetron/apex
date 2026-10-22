import { inline, sound } from '../../builders';

export default inline(4, {
  id: 'i4-4b11t',
  name: 'Inline-4 2.0 turbo, square bore/stroke',
  layoutLabel: 'Inline-4, flat (180°) crank, aluminium block',
  examples: ['Mitsubishi 4B11T (Lancer Evolution X)', 'Mitsubishi 4G63T (Evolution I–IX)'],
  boreMm: 86,
  strokeMm: 86,
  rodMm: 143.75,
  borePitchMm: 96,
  firingOrder: [1, 3, 4, 2],
  valvetrain: { type: 'dohc', valvesPerCyl: 4 },
  induction: 'turbo',
  idleRpm: 800,
  redlineRpm: 7000,
  massKg: 150,
  powerKw: 226,
  torqueNm: 414,
  sound: sound({
    character: 'thrum',
    // twin-scroll turbo on a short stainless manifold
    headerMm: 350,
    turbo: { count: 1, spoolRpm: 2800, maxShaftKrpm: 200, bov: true, antiLag: true },
  }),
  notes:
    'The first Evolution engine with an aluminium block, 12 kg lighter than the iron 4G63 it replaced; it shares the 96 mm bore pitch of the 4B1 "World Engine" family.',
  source:
    '4B11T: 86 × 86 mm, 1998 cc, 96 mm bore pitch — Wikipedia "Mitsubishi 4B1 engine"; rod 143.7 mm (5.656 in, aftermarket rod listings); 2015 Evolution Final Edition (US) 303 hp (226 kW) / 305 lb-ft (414 Nm) — Mitsubishi USA; ~ installed mass estimated',
});
