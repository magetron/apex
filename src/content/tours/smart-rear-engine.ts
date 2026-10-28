import type { Tour } from '../types';

const tour: Tour = {
  id: 'smart-rear-engine',
  question: 'Why is the Smart’s engine in the back?',
  teaser: 'The shortest possible car with the most cabin.',
  steps: [
    {
      id: 'short',
      title: 'Almost no overhang',
      body: 'The dimension lines: the Smart is barely longer than many cars’ wheelbases, and almost nothing hangs beyond the wheels at either end.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        overlays: ['dimensions'],
        camera: 'side',
      },
    },
    {
      id: 'under-the-floor',
      title: 'Under the boot floor',
      body: 'Engine and gearbox sit across the car under the boot floor, right at the rear axle, the three-cylinder laid over so it fits beneath the floor.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        explode: 0.4,
        highlight: ['engine', 'gearbox'],
      },
    },
    {
      id: 'cabin',
      title: 'Cabin fills the car',
      body: 'The floor plan from above: with no engine in front, the occupants sit far forward and the cabin fills most of the length.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        overlays: ['floorplan'],
        camera: 'top',
      },
    },
    {
      id: 'tail-heavy',
      title: 'Weight at the back',
      body: 'Most of the weight rests on the rear wheels, which is why the Smart has wider tyres at the back and stability control as standard.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'internals' },
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'lift-off',
      title: 'Lift off: the tail goes',
      body: 'Lifting mid-corner: the short, tail-heavy Smart’s rear slides out and it spins, while the front-engined Golf only tightens its line.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'drive' },
        drive: { scenario: 'lift-off', ghosts: ['vw-golf-mk8'] },
      },
    },
  ],
  sources: [
    'https://en.wikipedia.org/wiki/Smart_Fortwo',
    'https://evo.co.uk/smart/fortwo/6556/smart-fortwo-brabus',
  ],
};

export default tour;
