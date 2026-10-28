import type { Tour } from '../types';

const tour: Tour = {
  id: 'porsche-911-rr',
  question: 'Why is a rear-engined Porsche 911 tricky to drive fast?',
  teaser: 'The engine hangs behind the rear axle.',
  steps: [
    {
      id: 'tail-heavy',
      title: 'Engine behind the axle',
      body: 'The flat-6 hangs behind the rear axle, so the centre of gravity sits well aft and the rear axle-load bar towers over the front one.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        highlight: ['engine'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'gearbox-ahead',
      title: 'Gearbox ahead of the engine',
      body: 'Exploded: the transaxle sits ahead of the engine, between it and the cabin, with the differential on the axle line.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        explode: 0.6,
        highlight: ['engine', 'gearbox', 'diff-rear'],
      },
    },
    {
      id: 'power-exit',
      title: 'Throttle: the nose runs wide',
      body: 'On the throttle out of a turn, load moves further onto the rear tyres and off a front that was light to begin with: the 911 pushes wide, while a rear-drive car with its engine in front slides its rear out.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'drive' },
        drive: { scenario: 'power-exit', ghosts: ['bmw-m340i-g20'] },
      },
    },
    {
      id: 'lift-off',
      title: 'Lift off: the tail swings',
      body: 'Lifting mid-corner takes load off the rear tyres, which carry the heavy tail: the 911 swings round, while the front-engined car only tightens its line.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'drive' },
        drive: { scenario: 'lift-off', ghosts: ['bmw-m340i-g20'] },
      },
    },
    {
      id: 'catch',
      title: 'Caught with opposite lock',
      body: 'When the tail goes, the driver steers out of the turn and the slide is caught; the same car without the correction spins.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'drive' },
        drive: { scenario: 'catch' },
      },
    },
    {
      id: 'boxster',
      title: 'Same maker, engine moved',
      body: 'The Boxster has a boxer engine too, a flat-4, but ahead of the rear axle with the gearbox behind it: the centre of gravity moves forward and the axle loads even out.',
      scene: {
        view: { vehicleId: 'porsche-718-boxster-t-982', level: 'internals' },
        highlight: ['engine', 'gearbox'],
        overlays: ['cg', 'axle-loads'],
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Porsche_911_(992)',
    'https://en.wikipedia.org/wiki/Lift-off_oversteer',
    'auto motor und sport technical data: 911 Carrera S Cabriolet (992), 718 Boxster T (982)',
  ],
};

export default tour;
