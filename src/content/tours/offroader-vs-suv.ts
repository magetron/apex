import type { Tour } from '../types';

const tour: Tour = {
  id: 'offroader-vs-suv',
  question: 'Why isn’t every SUV an off-roader?',
  teaser: 'Low range and locking diffs, or a tall hatchback.',
  steps: [
    {
      id: 'tall',
      title: 'A high centre of gravity',
      body: 'The G-Class body sits on a separate ladder frame, with the drivetrain stacked above it for ground clearance: rugged, but heavy, and the centre of gravity sits high.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'internals' },
        highlight: ['body'],
        overlays: ['cg'],
        camera: 'side',
      },
    },
    {
      id: 'transfer-case',
      title: 'A transfer case, low range',
      body: 'Behind the gearbox, a transfer case splits torque between the axles and adds a low-range gear set for crawling; its centre differential can be locked, and so can the front and rear ones.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'internals' },
        highlight: ['coupling', 'prop-front', 'diff-front', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'tiguan',
      title: 'The crossover: a tall Golf',
      body: 'The Tiguan is a Golf underneath: a one-piece body, a transverse engine, and a clutch that sends torque rearward only when the front tyres slip. No low range, no locking differentials.',
      scene: {
        view: { vehicleId: 'vw-tiguan-l-pro-mk3', level: 'internals' },
        highlight: ['engine', 'gearbox', 'coupling', 'prop-rear'],
        overlays: ['torque-flow', 'cg'],
      },
    },
    {
      id: 'on-road',
      title: 'On the road, less grip',
      body: 'Round the same widening circle the heavier, taller off-roader lets go at the front sooner than the crossover.',
      scene: {
        view: { vehicleId: 'mercedes-amg-g63-w465', level: 'drive' },
        drive: { scenario: 'skidpad', ghosts: ['vw-tiguan-l-pro-mk3'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Mercedes-Benz_G-Class',
    'https://en.wikipedia.org/wiki/Body-on-frame',
    'https://en.wikipedia.org/wiki/Volkswagen_Tiguan',
  ],
};

export default tour;
