import type { Tour } from '../types';

const tour: Tour = {
  id: 'offroader-vs-suv',
  question: 'Why isn’t every SUV an off-roader?',
  teaser: 'Ladder frame and locking diffs, or a tall hatchback.',
  steps: [
    {
      id: 'frame',
      title: 'Body on a ladder frame',
      body: 'The G-Class body sits on a separate steel ladder frame, with a rigid axle at the rear. It is rugged and easy to repair, but heavy, and everything stacks upward: watch how high the CG roundel sits.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'internals' },
        highlight: ['body'],
        overlays: ['cg'],
        camera: 'side',
      },
    },
    {
      id: 'transfer-case',
      title: 'Low range, three locks',
      body: 'Behind the gearbox, a transfer case splits torque between the axles and adds a low-range gear set for crawling. The centre, rear and front differentials can each be locked.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'internals' },
        highlight: ['coupling', 'prop-front', 'diff-front', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'solid-axle',
      title: 'Solid axle',
      body: 'The Wrangler keeps a rigid axle at both ends: both front wheels hang on one axle with the differential in its middle. When one wheel climbs a rock the other is pushed down, keeping both in contact: great articulation, but less refinement on the road.',
      scene: {
        view: { vehicleId: 'jeep-wrangler-rubicon-392-jl', level: 'part', part: 'diff-front' },
        highlight: ['wheel-front-left', 'wheel-front-right'],
      },
    },
    {
      id: 'tiguan',
      title: 'The crossover: a tall Golf',
      body: 'The Tiguan is a Golf underneath: a one-piece monocoque body, a transverse engine, and a clutch that sends torque rearward only when the front tyres slip. No low range, no locking differentials.',
      scene: {
        view: { vehicleId: 'vw-tiguan-l-pro-mk3', level: 'internals' },
        highlight: ['engine', 'gearbox', 'coupling', 'prop-rear'],
        overlays: ['torque-flow', 'cg'],
      },
    },
    {
      id: 'on-road',
      title: 'On the road',
      body: 'In the same lane change the lighter, lower crossover takes its new line more willingly. Watch the lateral acceleration build on both cars.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'drive' },
        drive: { scenario: 'lane-change', ghosts: ['vw-tiguan-l-pro-mk3'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Mercedes-Benz_G-Class',
    'https://en.wikipedia.org/wiki/Body-on-frame',
    'https://en.wikipedia.org/wiki/Jeep_Wrangler_(JL)',
    'https://en.wikipedia.org/wiki/Volkswagen_Tiguan',
  ],
};

export default tour;
