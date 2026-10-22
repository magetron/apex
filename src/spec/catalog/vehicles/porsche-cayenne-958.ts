import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'porsche-cayenne-958',
  name: 'Porsche Cayenne (958)',
  archetype: 'suv',
  examples: ['VW Touareg (7P, same platform)', 'Audi Q7 (4L)', 'BMW X5 (E70)'],
  years: '2010–2017',
  dims: {
    wheelbaseMm: 2895,
    trackFMm: 1655,
    trackRMm: 1669,
    lengthMm: 4846,
    widthMm: 1939,
    heightMm: 1705,
    overhangFMm: 935,
  },
  // 255/55 R18
  tires: { widthFMm: 255, widthRMm: 255, diameterMm: 738, mu: 0.95 },
  body: {
    style: 'suv',
    tail: 'hatch',
    bonnetHMm: 1090,
    beltHMm: 1150,
    cowlXMm: -380,
    roofFrontXMm: -1150,
    roofRearXMm: -3200,
    tailHMm: 1450,
    paint: '#3b4a5a',
  },
  bay: { widthMm: 1250, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'vr6-ea390',
    // BMW-style packaging: the front diff sits beside the sump, so the short VR6 straddles the
    // front axle line with most of it behind.
    position: 'front-mid',
    orientation: 'longitudinal',
    engineXMm: -60,
    crankYMm: 520,
    gearbox: 'inline',
    gearboxKg: 105,
    driven: 'all',
    // Porsche Traction Management: rear axle always driven, a map-controlled multi-plate clutch
    // behind the gearbox feeds the front prop shaft.
    awd: 'rear-biased-clutch',
    frontTorqueShare: 0.2,
    fuelTank: { litres: 85, xMm: -2350 },
  },
  chassis: 'monocoque',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '5', rows: 2 },
  luggageL: { rear: 670 },
  bodyCgFrac: 0.52,
  blurb:
    'A Touareg-platform monocoque with the engine just behind the front axle and a clutch that feeds the front wheels only when the rears need help.',
  published: {
    curbKg: 2030,
    frontPct: 53,
    source:
      'Kerb 4475 lb (2030 kg, Tiptronic S; 4398 lb manual), 255/55 R18, 22.4 gal (85 L), double-wishbone / multi-link, map-controlled multi-plate clutch AWD, front track 65.2 in — Porsche 2012 Cayenne specs (newsroom.porsche.com); 4846 × 1939 × 1705 mm, wheelbase 2895, track 1655/1669 — encycarpedia (958); ~ overhang 935 from the model (912 mm at this wheelbase; the model runs ~3 % short overall); ~ 53/47 split and engine position estimated',
  },
};

export default v;
