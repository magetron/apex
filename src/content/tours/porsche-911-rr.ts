import type { Tour } from '../types';

const tour: Tour = {
  id: 'porsche-911-rr',
  question: 'Why is a rear-engined Porsche 911 tricky to drive fast?',
  teaser: 'The engine hangs behind the rear axle.',
  steps: [
    {
      id: 'tail-heavy',
      title: 'Engine behind the axle',
      body: 'The flat-6 hangs behind the rear axle, so the CG roundel sits well aft. Read the axle-load bars: the rear tyres carry most of the car.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        highlight: ['engine'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'turned-round',
      title: 'Turned round',
      body: 'Exploded: the gearbox sits ahead of the engine, between it and the cabin, with the differential on the axle line. The engine faces backwards, timing end at the tail.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'internals' },
        explode: 0.6,
        highlight: ['engine', 'gearbox', 'diff-rear'],
      },
    },
    {
      id: 'traction',
      title: 'The upside: traction',
      body: 'Accelerating, load moves rearward onto tyres that already carry most of the weight, so the 911 puts its power down early. Compare the front-drive ghost, which runs out of front grip.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'drive' },
        drive: { scenario: 'power-exit', ghosts: ['vw-golf-gti-mk8'] },
      },
    },
    {
      id: 'lift-off',
      title: 'The pendulum',
      body: 'Lift off mid-corner: load shifts forward, the lightened rear tyres lose grip, and the heavy tail swings like a pendulum. Watch the yaw rate against the mid-engined Boxster.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'drive' },
        drive: { scenario: 'lift-off', ghosts: ['porsche-718-boxster-t-982'] },
      },
    },
    {
      id: 'cayman',
      title: 'Same maker, engine moved',
      body: 'The Boxster has a boxer engine too, a flat-4, but ahead of the rear axle and turned round, with the gearbox behind it. Watch the CG roundel move forward and the axle loads even out.',
      scene: {
        view: { vehicleId: 'porsche-718-boxster-t-982', level: 'internals' },
        highlight: ['engine', 'gearbox'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'taming',
      title: 'How it was tamed',
      body: 'Modern 911s fight the pendulum with a longer wheelbase than the original, rear tyres much wider than the fronts, optional rear-axle steering and stability control. Compare the tyre widths front and rear.',
      scene: {
        view: { vehicleId: 'porsche-911-992', level: 'car' },
        overlays: ['dimensions'],
        camera: 'top',
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
