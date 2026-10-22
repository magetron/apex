import type { Tour } from '../types';

const tour: Tour = {
  id: 'engine-sounds',
  question: 'Why do engines sound different?',
  teaser: 'Firing order and exhaust plumbing, straight from the geometry.',
  steps: [
    {
      id: 'cross-plane',
      title: 'Cross-plane V8: burble',
      body: 'The crank pins sit at right angles to each other. Each bank therefore fires at uneven intervals, so each bank’s exhaust carries lumpy pulses: the classic V8 burble. Watch the firing timeline per bank.',
      scene: {
        view: { vehicleId: 'mercedes-amg-c63-s-coupe-c205', level: 'part', part: 'engine' },
        highlight: ['engine/crank'],
        sound: true,
        rpm: 2500,
      },
    },
    {
      id: 'flat-plane',
      title: 'Flat-plane V8: shriek',
      body: 'Here all pins lie in one plane, like two inline-4s on one crank. Each bank fires evenly, giving a harder, higher note, and the lighter crank revs faster.',
      scene: {
        view: { vehicleId: 'ferrari-f8-tributo', level: 'part', part: 'engine' },
        highlight: ['engine/crank'],
        sound: true,
        rpm: 6000,
      },
    },
    {
      id: 'boxer',
      title: 'Boxer: rumble',
      body: 'Subaru’s boxer fires evenly, but its exhaust pipes from each bank have different lengths, so the pulses reach the collector out of step. That off-beat rumble comes from the plumbing, not the crank.',
      scene: {
        view: { vehicleId: 'subaru-wrx-sti', level: 'part', part: 'engine' },
        highlight: ['engine/head-0', 'engine/head-1'],
        sound: true,
        rpm: 2500,
      },
    },
    {
      id: 'five',
      title: 'Inline-5: warble',
      body: 'Five cylinders share two crank turns, so one turn holds three firings and the next only two. That alternating rhythm is the inline-5’s warble; watch the firing timeline.',
      scene: {
        view: { vehicleId: 'audi-sport-quattro-1984', level: 'part', part: 'engine' },
        sound: true,
        rpm: 4000,
      },
    },
    {
      id: 'ten',
      title: 'V10: howl',
      body: 'At high rpm the V10’s many evenly spaced firings blur into a continuous howl. Slow the animation to see the individual power strokes.',
      scene: {
        view: { vehicleId: 'audi-r8-v10-gen2', level: 'part', part: 'engine' },
        sound: true,
        rpm: 8000,
        timeScale: 0.05,
      },
    },
    {
      id: 'three',
      title: 'Inline-3: thrum',
      body: 'Few, widely spaced power pulses and an end-to-end rocking couple give the triple its thrummy, off-beat note. Turn on the balance view to see the rocking.',
      scene: {
        view: { vehicleId: 'smart-fortwo-brabus-451', level: 'part', part: 'engine' },
        sound: true,
        balance: true,
        rpm: 2000,
      },
    },
    {
      id: 'electric',
      title: 'EV: whine',
      body: 'An electric motor has no firings at all. What you hear is the motor’s electrical frequency, the inverter switching and the reduction gears meshing, all rising together with speed.',
      scene: {
        view: { vehicleId: 'tesla-model3-awd', level: 'part', part: 'motor-rear' },
        sound: true,
      },
    },
  ],
  sources: [
    'S. Baldan, H. Lachambre, S. Delle Monache and P. Boussard, "Physically informed car engine sound synthesis for virtual and augmented environments", IEEE SIVE (2015)',
    'https://en.wikipedia.org/wiki/Crossplane',
    'https://en.wikipedia.org/wiki/Flat-four_engine',
    'https://en.wikipedia.org/wiki/Straight-five_engine',
  ],
};

export default tour;
