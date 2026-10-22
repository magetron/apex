/** Short, one-sentence definitions for terms the tours and labels use. */
import type { GlossaryEntry } from './types';

export const GLOSSARY: GlossaryEntry[] = [
  // ── Layout and mass ──
  {
    term: 'Weight distribution',
    short:
      'The share of a car’s static weight carried by the front and rear axles, usually quoted front/rear in percent.',
    seeAlso: ['Centre of gravity'],
  },
  {
    term: 'Centre of gravity',
    short:
      'The single point where the car’s whole mass can be treated as acting; its height sets how much load shifts when braking, accelerating or cornering.',
    seeAlso: ['Weight distribution', 'Load transfer'],
  },
  {
    term: 'Polar moment of inertia',
    short:
      'Resistance to rotating about a vertical axis through the CG (yaw inertia); mass far from the centre raises it and slows the car’s response to steering.',
    seeAlso: ['Mid-engine'],
  },
  {
    term: 'Load transfer',
    short:
      'The shift of tyre load between axles or sides when the car accelerates, brakes or corners, proportional to CG height over wheelbase or track.',
    seeAlso: ['Centre of gravity', 'Lift-off oversteer'],
  },
  {
    term: 'Wheelbase',
    short: 'The distance between the front and rear axle centres.',
  },
  {
    term: 'Track',
    short: 'The distance between the centres of the left and right tyres on one axle.',
  },
  {
    term: 'Overhang',
    short: 'How far the body extends ahead of the front axle or behind the rear axle.',
  },
  {
    term: 'Front-mid engine',
    short:
      'A front engine mounted entirely behind the front axle line, which pulls its mass toward the middle of the car.',
    seeAlso: ['Mid-engine'],
  },
  {
    term: 'Mid-engine',
    short:
      'An engine placed between the cabin and the rear axle, inside the wheelbase, for low yaw inertia at the cost of rear-seat space.',
    seeAlso: ['Polar moment of inertia', 'Front-mid engine'],
  },
  {
    term: 'Rear-engine',
    short:
      'An engine mounted behind the rear axle, as in the Porsche 911 or the original Fiat 500, giving strong traction but a tail-heavy balance.',
    seeAlso: ['Lift-off oversteer'],
  },
  {
    term: 'Transverse engine',
    short:
      'An engine mounted with its crankshaft across the car, the usual choice for front-wheel drive because engine and gearbox form one compact unit.',
    seeAlso: ['Longitudinal engine', 'VR engine'],
  },
  {
    term: 'Longitudinal engine',
    short:
      'An engine mounted with its crankshaft along the car, the usual choice for rear- and four-wheel-drive layouts with a prop shaft.',
    seeAlso: ['Transverse engine'],
  },
  {
    term: 'Frunk',
    short:
      'A front luggage compartment, found where there is no engine in the nose: rear- and mid-engined cars and most EVs.',
  },
  // ── Handling ──
  {
    term: 'Understeer',
    short:
      'When the front tyres reach their grip limit first, so the car turns less than the steering asks and runs wide.',
    seeAlso: ['Understeer gradient', 'Oversteer'],
  },
  {
    term: 'Oversteer',
    short:
      'When the rear tyres reach their grip limit first, so the tail slides out and the car turns more than the steering asks.',
    seeAlso: ['Understeer', 'Lift-off oversteer'],
  },
  {
    term: 'Understeer gradient',
    short:
      'How much extra steering angle a car needs per unit of lateral acceleration on a constant-radius circle; positive means understeer.',
    seeAlso: ['Understeer'],
  },
  {
    term: 'Lift-off oversteer',
    short:
      'Oversteer triggered by lifting off the throttle mid-corner: load moves forward, the lightened rear tyres lose grip and the tail swings out.',
    seeAlso: ['Load transfer', 'Rear-engine'],
  },
  {
    term: 'Power understeer',
    short:
      'Understeer under acceleration in a front-drive car, because the front tyres must both steer and drive while load moves rearward off them.',
    seeAlso: ['Understeer', 'Torque steer'],
  },
  {
    term: 'Torque steer',
    short:
      'A tug on the steering under hard acceleration in a front-drive car, caused by unequal drive-shaft angles or lengths and uneven grip.',
    seeAlso: ['Half shaft'],
  },
  {
    term: 'Torque vectoring',
    short:
      'Sending different drive torque to the left and right wheels to help the car rotate, using clutches, an active differential or separate motors.',
  },
  // ── Driveline ──
  {
    term: 'Transaxle',
    short:
      'A gearbox and differential combined in one housing, placed at the driven axle (911, R8, AMG GT, GT-R).',
    seeAlso: ['Differential'],
  },
  {
    term: 'Prop shaft',
    short:
      'The long shaft that carries torque along the car from the gearbox to a differential on the other axle.',
  },
  {
    term: 'Half shaft',
    short:
      'The short shaft with constant-velocity joints that carries torque from a differential to one wheel.',
  },
  {
    term: 'Torque tube',
    short:
      'A rigid tube that joins the engine to a rear transaxle and encloses the prop shaft, so the two act as one stiff unit.',
    seeAlso: ['Transaxle'],
  },
  {
    term: 'Differential',
    short:
      'A gear set that splits torque between two outputs while letting them turn at different speeds, as the wheels must through a corner.',
    seeAlso: ['Limited-slip differential', 'Centre differential'],
  },
  {
    term: 'Limited-slip differential',
    short:
      'A differential that resists a large speed difference between its outputs, so a wheel with little grip cannot take all the torque.',
    seeAlso: ['Differential', 'Torsen'],
  },
  {
    term: 'Centre differential',
    short:
      'A differential between the front and rear axles of a permanent four-wheel-drive car, letting them turn at different speeds.',
    seeAlso: ['Torsen', 'Transfer case'],
  },
  {
    term: 'Torsen',
    short:
      'A torque-sensing worm-gear differential that biases torque toward the axle or wheel with more grip, used as a centre diff in many quattros.',
    seeAlso: ['Centre differential', 'Limited-slip differential'],
  },
  {
    term: 'Haldex',
    short:
      'An electronically controlled multi-plate clutch that couples the rear axle of a front-drive car on demand, as in many VW-group 4MOTION cars.',
    seeAlso: ['Power take-off unit'],
  },
  {
    term: 'Power take-off unit',
    short:
      'The angle drive on a transverse gearbox that turns drive through a right angle into the prop shaft of an all-wheel-drive car.',
    seeAlso: ['Haldex'],
  },
  {
    term: 'Transfer case',
    short:
      'A gearbox behind the main gearbox of an off-roader that splits drive between the axles and usually adds a low-range gear set.',
    seeAlso: ['Low range', 'Locking differential'],
  },
  {
    term: 'Low range',
    short:
      'A reduction gear set in the transfer case that multiplies torque and slows the car for steep climbs and crawling over rocks.',
    seeAlso: ['Transfer case'],
  },
  {
    term: 'Locking differential',
    short:
      'A differential that can be locked so both outputs turn together, keeping drive on a wheel with grip when the other has none.',
    seeAlso: ['Differential'],
  },
  {
    term: 'Single-speed reduction',
    short:
      'The one fixed gear ratio between an electric motor and its wheels, possible because a motor makes torque across a very wide speed range.',
  },
  // ── Engines ──
  {
    term: 'Bore pitch',
    short:
      'The distance between neighbouring cylinder centres along the block, which with the cylinder count sets the engine’s length.',
  },
  {
    term: 'Firing order',
    short:
      'The sequence in which the cylinders fire, chosen to spread power pulses and loads evenly along the crankshaft.',
    seeAlso: ['Firing interval'],
  },
  {
    term: 'Firing interval',
    short:
      'The crank angle between successive power strokes, which sets the rhythm of an engine’s exhaust note.',
    seeAlso: ['Firing order'],
  },
  {
    term: 'Primary balance',
    short: 'Cancellation of the shaking forces and couples that occur once per crank revolution.',
    seeAlso: ['Secondary balance', 'Balance shaft'],
  },
  {
    term: 'Secondary balance',
    short:
      'Cancellation of the shaking forces and couples that occur twice per revolution, caused by the con-rod’s angle; an inline-4 lacks it.',
    seeAlso: ['Primary balance', 'Balance shaft'],
  },
  {
    term: 'Balance shaft',
    short:
      'A weighted shaft geared to the crank that spins to cancel an engine’s leftover shaking force or couple.',
    seeAlso: ['Secondary balance'],
  },
  {
    term: 'Crossplane',
    short:
      'A V8 crankshaft with its pins at right angles, smooth in primary balance but firing each bank unevenly, which gives the V8 burble.',
    seeAlso: ['Flatplane'],
  },
  {
    term: 'Flatplane',
    short:
      'A V8 crankshaft with all pins in one plane, like two inline-4s: lighter and even-firing per bank, but with a second-order shake.',
    seeAlso: ['Crossplane', 'Secondary balance'],
  },
  {
    term: 'Boxer',
    short:
      'A flat engine whose opposed pistons move in and out together, cancelling most shaking forces and sitting low in the car.',
  },
  {
    term: 'VR engine',
    short:
      'VW’s narrow-angle V whose staggered cylinders share one block and head, short enough to fit six cylinders across a front-drive car.',
    seeAlso: ['Transverse engine', 'W engine'],
  },
  {
    term: 'W engine',
    short: 'Two narrow-angle VR blocks on one crankshaft, as in VW’s W12 and Bugatti’s W16.',
    seeAlso: ['VR engine'],
  },
  {
    term: 'Hot vee',
    short:
      'A V engine with its turbochargers inside the vee between the banks, for a short exhaust path and a compact package.',
  },
  {
    term: 'Dry sump',
    short:
      'Lubrication with a separate oil tank and scavenge pumps instead of an oil pan, so the engine can sit lower and survive high cornering loads.',
  },
  {
    term: 'Unequal-length headers',
    short:
      'Exhaust pipes of different lengths from each cylinder, so pulses reach the collector out of step and the engine sounds lumpy.',
    seeAlso: ['Boxer'],
  },
  {
    term: 'Induction motor',
    short:
      'An electric motor whose rotor currents are induced by the stator field, needing no magnets and dragging little when it freewheels.',
    seeAlso: ['Permanent-magnet motor'],
  },
  {
    term: 'Permanent-magnet motor',
    short:
      'An electric motor with magnets in the rotor, usually the most efficient choice for the main drive axle of an EV.',
    seeAlso: ['Induction motor'],
  },
  // ── Body and chassis ──
  {
    term: 'Monocoque',
    short:
      'A body whose pressed and welded panels themselves carry the loads, without a separate chassis frame: almost every modern car.',
    seeAlso: ['Ladder frame'],
  },
  {
    term: 'Ladder frame',
    short:
      'A separate chassis of two long rails joined by cross-members, with the body bolted on top: tough and repairable but heavy and tall.',
    seeAlso: ['Monocoque'],
  },
  {
    term: 'Space frame',
    short:
      'A chassis built from joined tubes, extrusions or castings that carry the loads, with the outer panels doing little structural work.',
  },
  {
    term: 'Carbon tub',
    short:
      'A passenger cell moulded from carbon-fibre composite, very stiff and light, to which the engine and suspension bolt.',
  },
  {
    term: 'Solid axle',
    short:
      'A rigid beam joining the left and right wheels, so one wheel rising tilts the other: strong and good for articulation, poor for refinement.',
  },
  {
    term: 'MacPherson strut',
    short:
      'A compact suspension where the damper and spring form the upper locating link, leaving room for a transverse engine between the towers.',
  },
  {
    term: 'Double wishbone',
    short:
      'A suspension with two A-shaped arms per wheel that control camber precisely as it moves.',
  },
  {
    term: 'Twist beam',
    short:
      'A cheap, compact rear suspension where a cross-beam that twists links two trailing arms.',
  },
];

export const findTerm = (term: string): GlossaryEntry | undefined =>
  GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
