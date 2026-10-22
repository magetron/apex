import type { VehicleSpec } from '../../types';

const v: VehicleSpec = {
  id: 'ferrari-f8-tributo',
  name: 'Ferrari F8 Tributo',
  archetype: 'supercar',
  examples: ['Ferrari 488 GTB', 'Ferrari 458 Italia', 'McLaren 720S (carbon tub)'],
  dims: {
    wheelbaseMm: 2650,
    trackFMm: 1677,
    trackRMm: 1646,
    lengthMm: 4611,
    widthMm: 1979,
    heightMm: 1206,
    // measured on the 3D model (its length and wheelbase match Ferrari data)
    overhangFMm: 1140,
  },
  // 245/35 ZR20 front, 305/30 ZR20 rear
  // μ (lateral peak) 1.17, set so the sim's 100–0 km/h stop matches: 100–0 km/h 30.6 m — Auto Bild,
  // Mar 2021 (on optional Michelin Cup 2)
  // ~ kind: OE Michelin Pilot Sport 4S; the Auto Bild test car ran optional Cup 2
  tires: { widthFMm: 245, widthRMm: 305, diameterMm: 680, mu: 1.17, kind: 'performance' },
  body: {
    style: 'supercar',
    tail: 'engine-deck',
    bonnetHMm: 760,
    beltHMm: 840,
    cowlXMm: -300,
    roofFrontXMm: -950,
    roofRearXMm: -1600,
    tailHMm: 1020,
    paint: '#c4161c',
  },
  bay: { widthMm: 1300, lengthMm: 1000 },
  powertrain: {
    kind: 'ice',
    engine: 'v8-f154',
    // Longitudinal, low (dry sump), ahead of the rear axle; the 7-speed DCT hangs behind it.
    position: 'mid',
    orientation: 'longitudinal',
    engineXMm: -2010,
    crankYMm: 330,
    gearbox: 'mid-transaxle',
    gearboxKg: 140,
    driven: 'rear',
    fuelTank: { litres: 78, xMm: -1450 },
  },
  chassis: 'spaceframe',
  suspension: { front: 'double-wishbone', rear: 'multilink' },
  seats: { layout: '2', rows: 1 },
  luggageL: { front: 200 },
  bodyCgFrac: 0.5,
  blurb:
    'The mid-engine ideal: a low flat-plane V8 between the cabin and the rear axle, rear drive only.',
  published: {
    curbKg: 1435,
    frontPct: 41.5,
    source:
      'Kerb 1435 kg (dry 1330 kg with lightweight options), 41.5/58.5 split, wheelbase 2650, track 1677/1646 — Ferrari data via dealer spec sheet and The Drive (2019); 4611 × 1979 × 1206 mm — Ferrari data; ~ front overhang from the 3D model',
  },
};

export default v;
