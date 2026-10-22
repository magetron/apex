import type { Tour } from '../types';

const tour: Tour = {
  id: 'smart-rear-engine',
  question: 'Why is the Smart’s engine in the back?',
  teaser: 'The shortest possible car with the most cabin.',
  steps: [
    {
      id: 'short',
      title: 'Almost no overhang',
      body: 'The Smart is barely longer than many cars’ wheelbases, yet seats two adults. Look at the dimension lines: almost nothing hangs beyond the wheels at either end.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'car' },
        overlays: ['dimensions'],
        camera: 'side',
      },
    },
    {
      id: 'under-the-floor',
      title: 'Under the boot floor',
      body: 'Engine and gearbox sit across the car under the boot floor, right at the rear axle. The three-cylinder is laid steeply over on its side so it fits under the floor.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox'],
      },
    },
    {
      id: 'cabin',
      title: 'Cabin fills the car',
      body: 'With no engine in front, the nose only holds a crash structure and radiator. The occupants sit far forward, and the floor plan shows the cabin filling most of the length.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'tail-heavy',
      title: 'Weight at the back',
      body: 'Most of the weight rests on the rear wheels, which is why the Smart has wider tyres at the back and stability control as standard. Read the axle-load bars.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'quick-to-turn',
      title: 'Quick to turn',
      body: 'In the same lane change, watch the Smart against a Golf: a very short wheelbase and a tail-heavy balance make it quick to rotate, one reason stability control comes as standard.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'drive' },
        drive: { scenario: 'lane-change', ghosts: ['vw-golf-mk8'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Smart_Fortwo',
    'https://evo.co.uk/smart/fortwo/6556/smart-fortwo-brabus',
  ],
};

export default tour;
