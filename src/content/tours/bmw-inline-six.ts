import type { Tour } from '../types';

const tour: Tour = {
  id: 'bmw-inline-six',
  question: 'Why is an inline-6 with rear-wheel drive the classic BMW recipe?',
  teaser: 'A perfectly balanced engine behind the axle, steering kept pure.',
  steps: [
    {
      id: 'balance',
      title: 'An engine that sits still',
      body: 'The balance view of the inline-6: the front three cylinders mirror the rear three, so primary and secondary forces and couples all cancel and nothing shakes. No balance shafts needed.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'part', part: 'engine' },
        balance: true,
        rpm: 3000,
        highlight: ['engine/crank'],
      },
    },
    {
      id: 'four-shakes',
      title: 'An inline-4 shakes',
      body: 'The inline-4 for contrast: the second-order forces of its pistons add up instead of cancelling, so it shakes up and down twice per revolution.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'part', part: 'engine' },
        balance: true,
        rpm: 3000,
      },
    },
    {
      id: 'behind-the-axle',
      title: 'Long engine, lengthwise',
      body: 'A long engine suits a lengthwise bay. BMW sets it behind the front axle line, with the gearbox and prop shaft behind that: the axle-load bars come out close to even.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        highlight: ['engine'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'split-jobs',
      title: 'Steering and drive apart',
      body: 'Torque flows down the prop shaft to the rear differential. The front tyres only steer and the rears only drive.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        highlight: ['prop-rear', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'audi',
      title: 'Audi: ahead of the axle',
      body: 'The longitudinal Audi engine hangs ahead of the front axle instead, with the front differential tucked behind it: the centre of gravity and the front-axle share move forward.',
      scene: {
        view: { vehicleId: 'audi-rs6-avant-gt-c8', level: 'internals' },
        highlight: ['engine', 'diff-front'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'power-exit',
      title: 'Throttle swings the tail',
      body: 'On the throttle out of a turn the evenly loaded, rear-driven BMW slides its rear out, so it can be steered on the throttle, while the nose-heavy Audi pushes its front wide.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'drive' },
        drive: { scenario: 'power-exit', ghosts: ['audi-rs6-avant-gt-c8'] },
      },
    },
  ],
  sources: [
    'C. F. Taylor, The Internal-Combustion Engine in Theory and Practice, vol. 2, MIT Press (1985), ch. 8 (balance)',
    'https://en.wikipedia.org/wiki/Engine_balance',
    'https://en.wikipedia.org/wiki/Quattro_(four-wheel-drive_system)',
  ],
};

export default tour;
