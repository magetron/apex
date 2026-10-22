import type { Tour } from '../types';

const tour: Tour = {
  id: 'bmw-inline-six',
  question: 'Why is an inline-6 with rear-wheel drive the classic BMW recipe?',
  teaser: 'A perfectly balanced engine behind the axle, steering kept pure.',
  steps: [
    {
      id: 'balance',
      title: 'An engine that sits still',
      body: 'Inside the inline-6 with the balance view on, the force and couple arrows stay flat. The front three cylinders mirror the rear three, so primary and secondary forces and couples all cancel. No balance shafts needed.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'part', part: 'engine' },
        balance: true,
        rpm: 3000,
        highlight: ['engine/crank'],
      },
    },
    {
      id: 'four-shakes',
      title: 'Compare: the inline-4',
      body: 'The inline-4 for contrast: its pistons’ second-order forces add up instead of cancelling, so it shakes up and down twice per revolution. Larger fours carry balance shafts to cancel it.',
      scene: {
        view: { vehicleId: 'vw-golf-gti-mk8', level: 'part', part: 'engine' },
        balance: true,
        rpm: 3000,
      },
    },
    {
      id: 'behind-the-axle',
      title: 'Long engine, lengthwise',
      body: 'A long engine suits a lengthwise bay. BMW sets it behind the front axle line, with the gearbox and prop shaft behind that. Read the axle-load bars: close to even.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        highlight: ['engine'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'split-jobs',
      title: 'Steering and drive apart',
      body: 'Torque flows down the prop shaft to the rear differential. The front tyres only steer and the rears only drive, so the steering stays free of torque steer.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'internals' },
        highlight: ['prop-rear', 'diff-rear'],
        overlays: ['torque-flow'],
      },
    },
    {
      id: 'audi',
      title: 'Audi: ahead of the axle',
      body: 'Audi’s longitudinal engines hang ahead of the front axle instead, with the front differential tucked behind them. Watch the CG roundel and the front-axle share move forward: more weight on the fronts means more understeer at the limit.',
      scene: {
        view: { vehicleId: 'audi-rs6-avant-gt-c8', level: 'internals' },
        highlight: ['engine', 'diff-front'],
        overlays: ['cg', 'axle-loads'],
      },
    },
    {
      id: 'same-corner',
      title: 'Same corner, two recipes',
      body: 'On the skidpad, watch which car needs more steering as the speed rises: the nose-heavy Audi, or the evenly loaded BMW.',
      scene: {
        view: { vehicleId: 'bmw-m340i-g20', level: 'drive' },
        drive: { scenario: 'skidpad', ghosts: ['audi-rs6-avant-gt-c8'] },
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
