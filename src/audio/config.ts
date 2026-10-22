/**
 * Spec → voice config. The only place the synth reads the spec: firing angles come from
 * firingEvents() (or a rotary's rotors), exhaust grouping from the cylinder heads, block
 * vibration from balance().
 */
import { balance } from '../spec/derive/balance';
import { firingEvents } from '../spec/derive/firing';
import type { EngineSoundParams, EngineSpec, MotorSpec } from '../spec/types';
import { mod } from '../spec/units';
import type {
  Addons,
  EngineVoiceConfig,
  MotorVoiceConfig,
  PortTiming,
  VoiceConfig,
} from './dsp/types';

export type SoundSource = EngineSpec | MotorSpec;

export const isMotor = (s: SoundSource): s is MotorSpec => 'polePairs' in s.sound;

/** A rotating force/couple vector is what crank counterweights and balance shafts cancel. */
const counterweighted = (rotating: boolean) => (rotating ? 0.3 : 1);

/**
 * Dual pipes heard from the left-rear quarter: the nearer (left) pipe is louder, and each pipe's
 * highs lean toward its own side. Only the highs: at a few metres both pipes reach both ears
 * almost alike in the lows, so there the banks sum as they do in the air (a V12 is heard as a
 * V12, not as one I6 per ear).
 */
function listener(groups: number) {
  if (groups === 1) return { gain: [1], pan: [0] };
  const x = Array.from({ length: groups }, (_, g) => g / (groups - 1));
  return { gain: x.map((u) => 1 - 0.1 * u), pan: x.map((u) => -0.6 + 1.2 * u) };
}

/**
 * Default silencer voicing: the can's low-pass corner for a 500 mm muffler, and the share of the
 * highs its straight-through core passes. Calibrated against real recordings (test/real.ts).
 */
const MUFFLER_HZ = 600;
const MUFFLER_LEAK = 0.45;
/**
 * The tailpipe radiates its outflow's rate of change: +6 dB/oct below this, so a low firing
 * fundamental is heard mostly through its harmonics (as in every recording below ~100 Hz).
 */
const RADIATE_HZ = 300;

/** Poppet valves on a typical road-engine cam, crank degrees after the firing TDC. */
const FOUR_STROKE: PortTiming = {
  evo: 130,
  evc: 370,
  ivo: 350,
  ivc: 590,
  openDeg: 0,
  exhaustStroke: [180, 360],
  intakeStroke: [360, 540],
  valves: true,
};

/**
 * Wankel ports, e-shaft degrees after a face fires (each stroke takes 270°): the exhaust port
 * opens ~70° before the power stroke ends and the next face reaches it 360° later, so a rotor's
 * port never shuts. A rotor flank uncovers it in ~15°; there is no valve to lift or seat.
 */
const ROTARY: PortTiming = {
  evo: 200,
  evc: 560,
  ivo: 470,
  ivc: 700,
  openDeg: 15,
  exhaustStroke: [270, 540],
  intakeStroke: [520, 700],
  valves: false,
};

/** Spec cylinder index of each rotor: rotors listed one per entry, or face by face (3 a rotor). */
function rotorCylinders(spec: EngineSpec): number[] {
  const n = spec.cylinders.length;
  const pins = [...new Set(spec.cylinders.map((c) => c.pin))];
  const byFace = n % 3 === 0 && pins.length === n / 3;
  return byFace
    ? pins.map((p) => spec.cylinders.findIndex((c) => c.pin === p))
    : [...spec.cylinders.keys()];
}

/**
 * Every combustion event of one 720° cycle, with the spec cylinder it comes from. A four-stroke
 * cylinder fires once a cycle. A rotor has three faces and turns at a third of e-shaft speed, so
 * it fires once per e-shaft turn: twice a cycle. Its phase is its firing angle; rotors that give
 * none apart are spread evenly, as every multi-rotor production engine is.
 */
function combustion(spec: EngineSpec): { deg: number; cyl: number }[] {
  if (spec.family !== 'rotary') {
    const deg = new Array<number>(spec.cylinders.length).fill(0);
    for (const e of firingEvents(spec)) deg[e.cyl] = e.deg;
    return deg.map((d, cyl) => ({ deg: d, cyl }));
  }
  const rotors = rotorCylinders(spec);
  let phase = rotors.map((i) => mod(spec.cylinders[i].fireDeg, 360));
  if (new Set(phase).size < rotors.length || !phase.every(Number.isFinite))
    phase = rotors.map((_, r) => (r * 360) / rotors.length);
  return rotors.flatMap((cyl, r) => [
    { deg: phase[r], cyl },
    { deg: phase[r] + 360, cyl },
  ]);
}

/** Firing order: combustion events per crank (e-shaft) revolution, the engine's main note. */
export const firingOrder = (spec: EngineSpec) => combustion(spec).length / 2;

/** Free forces and couples per crank order; a rotary has no reciprocating parts at all. */
function blockOrders(spec: EngineSpec, n: number) {
  if (spec.family === 'rotary') return [];
  const b = balance(spec);
  const lambda = spec.strokeMm / 2 / spec.rodMm;
  const order1 =
    b.primary.force * counterweighted(b.primary.forceRotating) +
    0.5 * b.primary.couple * counterweighted(b.primary.coupleRotating);
  const order2 =
    b.secondary.force * counterweighted(b.secondary.forceRotating) +
    0.5 * b.secondary.couple * counterweighted(b.secondary.coupleRotating);
  return [
    { order: 1, level: (0.25 * order1) / n },
    { order: 2, level: (0.75 * lambda * order2) / n },
  ];
}

/**
 * How hard the engine burbles on the overrun (0..1). That is a calibration choice, so it is read
 * from what marks a performance engine: specific output against what its breathing makes easily
 * (65 kW/L NA, 90 kW/L forced), or 300 kW from an NA engine (the big American V8s), or a rally
 * heritage of anti-lag. A limousine's turbo V12 makes the power but not the kW/L, and stays quiet.
 */
export function overrunBurble(spec: EngineSpec) {
  const kwPerL = spec.powerKw / (spec.displacementCc / 1000);
  const score =
    spec.sound.turbo?.antiLag === true
      ? 1
      : spec.induction === 'na'
        ? Math.max(kwPerL / 65, spec.powerKw / 300)
        : kwPerL / 90;
  return Math.min(1, Math.max(0, (score - 0.8) / 0.2));
}

export function engineVoiceConfig(
  spec: EngineSpec,
  override: Partial<EngineSoundParams> = {},
): EngineVoiceConfig {
  const snd = { ...spec.sound, ...override };
  const events = combustion(spec);
  const n = events.length;
  const rotary = spec.family === 'rotary';
  // one combustion chamber's swept volume per event (a rotor's chamber, not its three)
  const chambers = rotary ? n / 2 : n;

  // 'per-bank' and 'crossover' keep one collector per cylinder head (a VR6 has one head)
  const heads = events.map((e) => spec.banks[spec.cylinders[e.cyl].bank]?.head ?? 0);
  const uniq = [...new Set(heads)].sort((a, b) => a - b);
  const group = snd.collector === 'single' ? heads.map(() => 0) : heads.map((h) => uniq.indexOf(h));
  const groupCount = Math.max(...group) + 1;
  const head = heads.map((h) => uniq.indexOf(h));

  const h = snd.headerMm;
  const mean = Array.isArray(h) ? h.reduce((s, x) => s + x, 0) / h.length : h;
  const headerMm = events.map((e) =>
    Array.isArray(h) && h.length === spec.cylinders.length ? h[e.cyl] : mean,
  );

  const turbo = snd.turbo
    ? {
        count: snd.turbo.count,
        spoolRpm: snd.turbo.spoolRpm,
        maxShaftKrpm: snd.turbo.maxShaftKrpm,
        ventsToAir: snd.turbo.antiLag,
      }
    : spec.induction.includes('turbo')
      ? {
          count: spec.induction === 'quad-turbo' ? 4 : spec.induction === 'twin-turbo' ? 2 : 1,
          spoolRpm: 2500,
          maxShaftKrpm: 180,
          ventsToAir: false,
        }
      : null;

  const ear = listener(groupCount);
  return {
    kind: 'engine',
    id: spec.id,
    fireDeg: events.map((e) => e.deg),
    group,
    groupCount,
    head,
    headCount: uniq.length,
    crossover: snd.collector === 'crossover',
    headerMm,
    ports: structuredClone(rotary ? ROTARY : FOUR_STROKE),
    collectorMm: snd.collectorMm,
    mufflerMm: snd.mufflerMm,
    // a bigger can turns the corner lower
    mufflerHz: snd.muffler?.cutoffHz ?? MUFFLER_HZ * (500 / Math.max(150, snd.mufflerMm)),
    mufflerPoles: snd.muffler?.poles ?? 1,
    mufflerLeak: snd.muffler?.leak ?? MUFFLER_LEAK,
    radiateHz: snd.muffler?.lowHz ?? RADIATE_HZ,
    tailpipeMm: snd.tailpipeMm,
    groupGain: ear.gain,
    groupPan: ear.pan,
    mix: { ...snd.mix },
    boreMm: spec.boreMm,
    cylCc: spec.displacementCc / chambers,
    idleRpm: spec.idleRpm,
    redlineRpm: spec.redlineRpm,
    orders: blockOrders(spec, n),
    ohv: !rotary && spec.valvetrain.type === 'ohv',
    turbo,
    overrun: overrunBurble(spec),
    // more cylinders fill in the gaps (louder RMS), bigger ones push harder: keep engines
    // comparable while a big V8 still out-shouts a city triple
    gain: (10 * Math.pow(spec.displacementCc / 3000, 0.2)) / Math.pow(n / 4, 0.35),
  };
}

export function motorVoiceConfig(m: MotorSpec): MotorVoiceConfig {
  const stage1Ratio = Math.sqrt(m.reduction);
  return {
    kind: 'motor',
    id: m.id,
    polePairs: m.sound.polePairs,
    inverterHz: m.sound.inverterHz,
    gearWhine: m.sound.gearWhine,
    maxRpm: m.maxRpm,
    reduction: m.reduction,
    induction: m.kind === 'induction',
    // ~ typical EV two-stage reduction: small input pinion, second stage on the idler shaft
    pinionTeeth: 23,
    stage1Ratio,
    stage2Teeth: 19,
    // 2 slots per pole per phase
    statorSlots: 12 * m.sound.polePairs,
    // EVs are quiet, but this is a teaching tool: keep the whine audible next to the engines
    gain: 2,
  };
}

export const voiceConfig = (s: SoundSource): VoiceConfig =>
  isMotor(s) ? motorVoiceConfig(s) : engineVoiceConfig(s);

export type AddonKey = keyof Addons;

/** Which add-on toggles make sense for this source, in display order. */
export function availableAddons(s: SoundSource): AddonKey[] {
  if (isMotor(s)) return ['avas'];
  const turbo = s.sound.turbo !== undefined || s.induction.includes('turbo');
  return turbo ? ['spool', 'wastegate', 'bov', 'antiLag', 'crackle'] : ['crackle'];
}

/** Starting toggles: what the spec says the real engine has. */
export function defaultAddons(s: SoundSource | null): Addons {
  const t = s && !isMotor(s) ? s.sound.turbo : undefined;
  const turbo = !!s && !isMotor(s) && (t !== undefined || s.induction.includes('turbo'));
  return {
    // a road car's silencing hides its turbo; only a racing/rally heritage leaves it on show.
    // The chip stays offered, so the whine can be switched on to hear what a turbo adds.
    spool: turbo && t?.antiLag === true,
    wastegate: false,
    bov: t?.bov ?? false,
    // a show-off add-on: offered on every turbo engine, never on by default (it bangs whenever
    // the throttle is shut)
    antiLag: false,
    // performance engines burble on the overrun out of the box; others only if asked (faintly)
    crackle: !!s && !isMotor(s) && overrunBurble(s) >= 0.5,
    avas: false,
  };
}
