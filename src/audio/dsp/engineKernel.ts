/**
 * Physically informed combustion-engine voice (pure TS, no DOM: runs in the AudioWorklet and in
 * Node tests alike).
 *
 * Signal path, after Baldan & Delle Monache (2015) and its MIT ports DasEtwas/enginesound
 * (Rust) and Antonio-R1/engine-sound-generator (JS):
 *
 *   cylinder i ── exhaust valve ── header_i ─┐
 *   cylinder j ── exhaust valve ── header_j ─┼─ collector junction (per group) ── collector
 *        …                                   ┘     (+ afterfire, jet noise)         │
 *        [X-pipe junction when `crossover`] ◀──────────────────────────────────────┘
 *        ── muffler chamber (+ side resonator) ── tailpipe ── open end → listener (lows shared
 *           by both ears, highs panned per pipe)
 *   intake valves ── plenum pipe ── airbox mouth;  block: rpm-locked orders + knock + valvetrain
 *
 * Every timing comes from the firing angles in the config (spec → firingEvents), so a
 * cross-plane V8 burbles because its per-bank collectors receive uneven pulse trains, and an
 * unequal-header boxer rumbles because its pulses reach the collector unevenly — no
 * per-engine special cases. Differences from the references: the blowdown is a cylinder
 * emptying through the valve's opening area against the instantaneous port pressure (so
 * reflected waves modulate the next pulse — scavenging); the manifold pressure a cylinder's
 * valve overlap meets is exhaust gas it keeps for its next cycle (residual gas), so a collector
 * fed unevenly leaves its cylinders unevenly filled; each blowdown jet hisses into its own
 * collector; junctions scatter by pipe area; and turbo, anti-lag, crackle and rev-limiter
 * behaviour are our own additions. A rotary runs the same path with ports for valves (the
 * config's port timing), each rotor as two combustion events a cycle.
 */
import { Biquad, clamp, decayCoef, Limiter, OnePole, PulseEnv, Rng, TAU } from './primitives';
import { TurboModel } from './turbo';
import {
  NO_ADDONS,
  type Addons,
  type EngineVoiceConfig,
  type PortTiming,
  type Probe,
  type Voice,
  type VoiceEvent,
} from './types';
import { INDEX_MASK, Junction, Pipe } from './waveguide';

/** Speed of sound (m/s) cooling down the exhaust, and in the intake. */
const C_HEADER = 520;
const C_COLLECTOR = 480;
const C_MUFFLER = 440;
const C_TAIL = 400;
const C_INTAKE = 350;
const R_VALVE_CLOSED = 0.75;
const R_VALVE_OPEN = 0.35;
/** Port-pressure feedback on the blowdown flow (0 = linear source). */
const BACKPRESSURE = 0.25;
/** Excess cylinder pressure left at EVO with the fuel cut (compressed air only). */
const FUEL_CUT = 0.06;
/**
 * How strongly overlap pressure above its collector-mates' average weakens a cylinder's next
 * charge (residual gas), and the manifold's emptying time (s) for a 450 mm collector.
 */
const RESIDUAL = 0.7;
const MANIFOLD_S = 0.012;
/**
 * Turbulent hiss of each blowdown jet, above JET_HZ. Its amplitude grows with the square of the
 * valve outflow, so a throttled idle barely hisses while full load rasps.
 */
const JET = 0.3;
const JET_HZ = 800;
/**
 * Muffler chamber's wall losses per pass (Hz). (The can's low-pass corner and the share of the
 * highs its straight-through core passes come with the config: each car's silencer differs.)
 */
const CHAMBER_HZ = 2500;
/** Level restored above the radiation corner (config radiateHz), below which a pipe radiates less. */
const RADIATE_GAIN = 2.2;
/**
 * Steady turbulent roar of the exhaust flow (per unit flow): real engines are not pure tones. It
 * falls off at 12 dB/oct above ROAR_HZ, as flow noise does, so it fills the lows without hissing
 * in the 2–6 kHz band at full load.
 */
const ROAR = 0.35;
const ROAR_HZ = 800;
/** Cylinder-to-cylinder spread of charge and burn (±): no engine's cylinders are identical. */
const IMBALANCE = 0.04;
/** Above this both ears no longer hear the two pipes alike (head shadow, path difference). */
const EAR_SPLIT_HZ = 900;
/**
 * Valve overlap (deg) of a road cam. Cycle-to-cycle burn variation grows with overlap: more
 * exhaust gas back-flows into a thin part-load charge (a race cam's lope, a rotary's "brap").
 */
const OVERLAP_REF = 20;
/** Hiss of the air drawn past the intake valves, per unit suction. */
const INTAKE_HISS = 0.04;
const DEG = Math.PI / 180;
const MAX_POPS = 48;
/** Afterfire kinds in the pop queue. */
const Pop = {
  Bang: 1,
  Burble: 2,
} as const;
/**
 * Overrun burble: a pop's size (per unit cylinder), pops a second just after lift-off (whatever
 * the cylinder count or rpm), and how long a lift-off keeps them coming (s).
 */
const BURBLE = 0.07;
const BURBLE_RATE = 25;
const BURBLE_S = 1.5;
/** The late-burning charge a burble calibration keeps in each cylinder, as a share of a full one. */
const BURBLE_FUEL = 0.2;
/** Burble strength when the add-on is on for an engine whose maker would not calibrate it. */
const BURBLE_FAINT = 0.3;

const Fuel = {
  Burn: 0,
  Cut: 1,
  AntiLag: 2,
} as const;

/** Equal-power pan gains, pan -1..1. */
const panL = (p: number) => Math.cos(((p + 1) * Math.PI) / 4);
const panR = (p: number) => Math.sin(((p + 1) * Math.PI) / 4);
/** Cam-lift / piston-speed shape over 0..1 (a parabola: close to a half sine, much cheaper). */
const bump = (x: number) => 4 * x * (1 - x);

export interface KernelOptions {
  seed?: number;
  addons?: Addons;
  /** keep a log of combustion / afterfire / turbo events (tests) */
  recordEvents?: boolean;
  /** cycle-to-cycle combustion variation, 1 = default */
  jitter?: number;
}

export class EngineKernel implements Voice {
  readonly events: VoiceEvent[] | null;
  private readonly fs: number;
  private readonly cfg: EngineVoiceConfig;
  private readonly n: number;
  private readonly rng: Rng;
  private readonly jitter: number;
  private addons: Addons;

  // cylinders
  private readonly fire: Float64Array;
  private readonly cylGroup: Int32Array;
  private readonly prevTheta: Float64Array;
  private readonly charge: Float64Array;
  /** manifold pressure summed over each cylinder's valve overlap (sum, samples) */
  private readonly overlapP: Float64Array;
  private readonly overlapN: Float64Array;
  /** mean overlap pressure each cylinder last saw, and the filling that leaves its next charge */
  private readonly overlapLast: Float64Array;
  private readonly fill: Float64Array;
  /** each event's cylinder head, its slow (mean) manifold pressure, and this sample's outflow */
  private readonly cylHead: Int32Array;
  private readonly manifold: Float64Array;
  private readonly headFlow: Float64Array;
  private readonly kManifold: number;
  private readonly fuel: Uint8Array;
  private readonly blowRate: number;
  private readonly ports: PortTiming;
  /** how much rougher light-load combustion is than with a road cam's overlap */
  private readonly rough: number;
  private readonly sizeAmp: number;
  private readonly headers: Pipe[];

  // exhaust network
  private readonly pipes: Pipe[] = [];
  private readonly junctions: Junction[] = [];
  private readonly collectorJ: Junction[] = [];
  private readonly tails: Pipe[] = [];
  private readonly resonators: Pipe[] = [];
  private readonly openLp: OnePole[] = [];
  private readonly radHp: OnePole[] = [];
  private readonly canLp: OnePole[] = [];
  /** the second pole of a steeper (12 dB/oct) silencer */
  private readonly canLp2: OnePole[] = [];
  /** splits each pipe's sound into the lows both ears share and the highs panned per pipe */
  private readonly earHp: Biquad[] = [];
  /** valve outflow into each collector this sample: what its jet noise follows */
  private readonly jet: Float64Array;
  private readonly jetHp: OnePole[] = [];
  /** turbulent flow roar is mostly below a kilohertz or two */
  private readonly roarLp: Biquad[] = [];
  private readonly gLo: Float64Array;
  private readonly gL: Float64Array;
  private readonly gR: Float64Array;

  // intake
  private readonly intake: Pipe;
  private readonly intakeLp: OnePole;
  private readonly intakeHp: OnePole;
  private readonly intakeNoise: Biquad;

  // afterfire (per group) and the pop queue
  private readonly bang: PulseEnv[] = [];
  /** overrun afterfire: a soft, low "bwap" (slower than a bang, far slower than a crackle) */
  private readonly burble: PulseEnv[] = [];
  private readonly burst: Float64Array;
  private readonly kBurst: number;
  private readonly popT = new Float64Array(MAX_POPS);
  private readonly popAmp = new Float64Array(MAX_POPS);
  private readonly popGroup = new Int32Array(MAX_POPS);
  private readonly popKind = new Uint8Array(MAX_POPS);
  private popCount = 0;

  // block
  private readonly orderK: Float64Array;
  private readonly orderLvl: Float64Array;
  private readonly firingOrder: number;
  private readonly knock: PulseEnv;
  private readonly knockBand: Biquad;
  private readonly tick: Biquad;
  private readonly mechLp: OnePole;

  // output
  private readonly dcL: OnePole;
  private readonly dcR: OnePole;
  private readonly limiter: Limiter;
  private readonly turbo: TurboModel | null;

  // state
  private w = 0;
  private t = 0;
  private phi = 0;
  private rpm = 0;
  private slope = 0;
  private heat = 0;
  /** 1 at the moment of lift-off, fading while the overrun lasts */
  private lift = 0;
  private wasOverrun = false;
  private limPhase = 0;
  private sag = 0;
  private readonly kSag: number;

  constructor(cfg: EngineVoiceConfig, fs: number, opts: KernelOptions = {}) {
    this.cfg = cfg;
    this.fs = fs;
    this.n = cfg.fireDeg.length;
    this.rng = new Rng(opts.seed ?? 1);
    this.jitter = opts.jitter ?? 1;
    this.addons = opts.addons ?? NO_ADDONS;
    this.events = opts.recordEvents ? [] : null;
    this.rpm = cfg.idleRpm;
    const n = this.n;

    this.fire = Float64Array.from(cfg.fireDeg, (d) => ((d % 720) + 720) % 720);
    this.cylGroup = Int32Array.from(cfg.group);
    this.prevTheta = new Float64Array(n);
    for (let i = 0; i < n; i++) this.prevTheta[i] = (720 - this.fire[i]) % 720;
    this.charge = new Float64Array(n);
    this.overlapP = new Float64Array(n);
    this.overlapN = new Float64Array(n);
    this.fill = new Float64Array(n).fill(1);
    this.overlapLast = new Float64Array(n);
    this.cylHead = Int32Array.from(cfg.head);
    this.manifold = new Float64Array(cfg.headCount);
    this.headFlow = new Float64Array(cfg.headCount);
    // a longer collector holds more gas, and a turbine in the way slows its emptying
    this.kManifold =
      1 - decayCoef(MANIFOLD_S * (cfg.collectorMm / 450) * (cfg.turbo ? 1.5 : 1), fs);
    this.fuel = new Uint8Array(n);
    // a bigger cylinder takes longer to empty through its valves
    this.blowRate = 1 / (0.0007 * Math.cbrt(cfg.cylCc / 500));
    this.ports = cfg.ports;
    this.rough = Math.max(1, (cfg.ports.evc - cfg.ports.ivo) / OVERLAP_REF);
    this.sizeAmp = Math.sqrt(cfg.cylCc / 500);

    // ── exhaust network ──
    const G = cfg.groupCount;
    const perGroup = Array.from({ length: G }, (_, g) => cfg.group.filter((x) => x === g).length);
    const turbine = cfg.turbo !== null;
    this.headers = cfg.headerMm.map((mm, i) => {
      // no two primaries run at quite the same gas temperature (±3%): this smears the deep
      // comb notches a set of perfectly identical closed side branches would cut
      const c = C_HEADER * (1 + 0.03 * Math.sin(2.4 * i + 1));
      const p = new Pipe({ mm, c, area: 1, gain: 0.95, lossHz: 3500 }, fs);
      this.pipes.push(p);
      return p;
    });
    const collectors: Pipe[] = [];
    const chambers: Pipe[] = [];
    this.gL = new Float64Array(G);
    this.gR = new Float64Array(G);
    this.gLo = new Float64Array(G);
    for (let g = 0; g < G; g++) {
      const area = Math.max(1.4, 0.55 * perGroup[g]);
      // a turbine in the collector soaks up pulse energy and blunts the highs
      const collector = new Pipe(
        {
          mm: cfg.collectorMm,
          c: C_COLLECTOR,
          area,
          gain: turbine ? 0.8 : 0.96,
          lossHz: turbine ? 1500 : 5000,
        },
        fs,
      );
      const chamber = new Pipe(
        { mm: cfg.mufflerMm, c: C_MUFFLER, area: area * 1.3, gain: 0.85, lossHz: CHAMBER_HZ },
        fs,
      );
      const resonator = new Pipe(
        { mm: cfg.mufflerMm * 0.45, c: C_MUFFLER, area: area * 0.3, gain: 0.8, lossHz: 3000 },
        fs,
      );
      const tail = new Pipe(
        { mm: cfg.tailpipeMm, c: C_TAIL, area: area * 0.9, gain: 0.97, lossHz: 5000 },
        fs,
      );
      this.pipes.push(collector, chamber, resonator, tail);
      collectors.push(collector);
      chambers.push(chamber);
      this.resonators.push(resonator);
      this.tails.push(tail);
      const ports: [Pipe, 0 | 1][] = this.headers.flatMap((h, i) =>
        cfg.group[i] === g ? [[h, 1] as [Pipe, 1]] : [],
      );
      const cj = new Junction([...ports, [collector, 0]]);
      this.collectorJ.push(cj);
      this.junctions.push(cj);
      this.junctions.push(
        new Junction([
          [chamber, 1],
          [resonator, 0],
          [tail, 0],
        ]),
      );
      this.openLp.push(new OnePole(1400, fs));
      this.radHp.push(new OnePole(cfg.radiateHz, fs));
      this.canLp2.push(new OnePole(cfg.mufflerHz, fs));
      this.canLp.push(new OnePole(cfg.mufflerHz, fs));
      this.earHp.push(new Biquad(fs, 'highpass', EAR_SPLIT_HZ, Math.SQRT1_2));
      this.jetHp.push(new OnePole(JET_HZ, fs));
      this.roarLp.push(new Biquad(fs, 'lowpass', ROAR_HZ, Math.SQRT1_2));
      const gain = cfg.groupGain[g] ?? 1;
      const pan = cfg.groupPan[g] ?? 0;
      this.gL[g] = gain * panL(pan);
      this.gR[g] = gain * panR(pan);
      this.gLo[g] = gain * Math.SQRT1_2;
    }
    if (cfg.crossover && G > 1) {
      this.junctions.push(
        new Junction([
          ...collectors.map((c) => [c, 1] as [Pipe, 1]),
          ...chambers.map((c) => [c, 0] as [Pipe, 0]),
        ]),
      );
    } else {
      for (let g = 0; g < G; g++)
        this.junctions.push(
          new Junction([
            [collectors[g], 1],
            [chambers[g], 0],
          ]),
        );
    }

    // ── intake: one plenum/airbox pipe fed by every intake valve ──
    this.intake = new Pipe(
      { mm: 300 + 0.12 * cfg.cylCc, c: C_INTAKE, area: 1, gain: 0.95, lossHz: 4000 },
      fs,
    );
    this.pipes.push(this.intake);
    this.intakeLp = new OnePole(2000, fs);
    this.intakeHp = new OnePole(40, fs);
    this.intakeNoise = new Biquad(fs, 'bandpass', 1800, 0.9);

    // ── afterfire ──
    for (let g = 0; g < G; g++) {
      this.bang.push(new PulseEnv(0.0002, 0.004, fs));
      this.burble.push(new PulseEnv(0.001, 0.006, fs));
    }
    this.burst = new Float64Array(G);
    this.jet = new Float64Array(G);
    this.kBurst = decayCoef(0.006, fs);

    // ── block vibration ──
    this.orderK = Float64Array.from(cfg.orders, (o) => o.order);
    this.orderLvl = Float64Array.from(cfg.orders, (o) => o.level);
    this.firingOrder = n / 2;
    this.knock = new PulseEnv(0.00005, 0.0006, fs);
    this.knockBand = new Biquad(fs, 'bandpass', 1100 * Math.cbrt(500 / cfg.cylCc), 5);
    this.tick = new Biquad(fs, 'bandpass', 4200, 6);
    this.mechLp = new OnePole(2500, fs);

    this.dcL = new OnePole(18, fs);
    this.dcR = new OnePole(18, fs);
    this.limiter = new Limiter(fs, 0.9, 0.12);
    this.turbo = cfg.turbo ? new TurboModel(cfg.turbo, fs, this.rng, this.events) : null;
    this.kSag = 1 - decayCoef(1 / (TAU * 12), fs);
  }

  setAddons(a: Addons) {
    this.addons = a;
  }

  /** Shaft speed and boost for UI readouts (null for NA engines). */
  turboState(): { shaft: number; boost: number; gate: number } | null {
    return this.turbo
      ? { shaft: this.turbo.shaft, boost: this.turbo.boost, gate: this.turbo.gate }
      : null;
  }

  private schedulePop(t: number, amp: number, group: number, kind: number) {
    if (this.popCount >= MAX_POPS) return;
    const k = this.popCount++;
    this.popT[k] = t;
    this.popAmp[k] = amp;
    this.popGroup[k] = group;
    this.popKind[k] = kind;
  }

  private firePops() {
    for (let k = 0; k < this.popCount;) {
      if (this.popT[k] <= this.t) {
        const g = this.popGroup[k];
        const a = this.popAmp[k];
        const kind = this.popKind[k];
        if (kind === Pop.Bang) this.bang[g].trigger(a);
        else this.burble[g].trigger(a);
        // the flame front's crack: sharp on an anti-lag bang, a hint on a soft burble
        this.burst[g] += a * (kind === Pop.Bang ? 0.5 : 0.08);
        const last = --this.popCount;
        this.popT[k] = this.popT[last];
        this.popAmp[k] = this.popAmp[last];
        this.popGroup[k] = this.popGroup[last];
        this.popKind[k] = this.popKind[last];
      } else k++;
    }
  }

  render(
    L: Float32Array,
    R: Float32Array,
    len: number,
    rpmTarget: number,
    throttleTarget: number,
    probe?: Probe,
  ) {
    const cfg = this.cfg;
    const fs = this.fs;
    const a = this.addons;
    const n = this.n;
    const dt = len / fs;
    const r0 = this.rpm;
    // a NaN from upstream would poison every pipe: hold the last good value instead
    const r1 = Number.isFinite(rpmTarget) ? clamp(rpmTarget, 0, cfg.redlineRpm * 1.05) : r0;
    const t1 = Number.isFinite(throttleTarget) ? clamp(throttleTarget, 0, 1) : 0;
    this.rpm = r1;

    // ── control rate: what the ECU is doing this block ──
    this.slope += ((r1 - r0) / dt - this.slope) * (1 - Math.exp(-dt / 0.08));
    const running = r1 > 0.3 * cfg.idleRpm;
    const turbo = this.turbo;
    const antiLag = a.antiLag && turbo !== null && t1 < 0.2 && r1 > Math.max(2200, 2 * cfg.idleRpm);
    // closed throttle and falling revs: the ECU cuts fuel (overrun)
    const overrun = t1 < 0.04 && r1 > 1.3 * cfg.idleRpm && this.slope < -150;
    // revving freely still burns some fuel to hold the revs (friction grows with rpm²)
    const hold = r1 < 1.3 * cfg.idleRpm ? 0.2 : 0.1 + 0.2 * (r1 / cfg.redlineRpm) ** 2;
    const load = overrun ? 0 : Math.max(t1, hold);
    const limiting = r1 >= cfg.redlineRpm - 40 && t1 > 0.25;
    if (limiting) this.limPhase = (this.limPhase + dt * 9) % 1;
    else this.limPhase = 0;
    const limCut = limiting && this.limPhase < 0.5;
    this.heat +=
      ((load > 0.5 ? 1 : 0) - this.heat) * (1 - Math.exp(-dt / (load > 0.5 ? 1.5 : 2.5)));
    if (turbo) turbo.update(dt, r1, load, t1, antiLag, a, this.t);
    const boost = turbo ? turbo.boost : 0;
    const burnAmp = (0.3 + 0.7 * load) * (1 + 0.6 * boost) * this.sizeAmp;
    // a modern road engine burns within a few % cycle to cycle, a little worse at a thin
    // part-load charge; lumpiness beyond that comes from the layout, not from here
    const sigma =
      this.jitter * (0.015 + (r1 < 1.5 * cfg.idleRpm ? 0.035 : 0.015) * (1 - load) * this.rough);
    const rpmFrac = r1 / cfg.redlineRpm;
    const pumpAmp = 0.08 * rpmFrac * this.sizeAmp;
    // exhaust gas flow; a turbine in the way slows and calms it rather than adding hiss
    const flow = rpmFrac * (0.2 + 0.8 * load);
    // turbulent roar of the gas streaming down the pipes, steady (between the pulses' own hiss)
    const flowNoise = (0.012 * flow * flow + ROAR * flow) * this.sizeAmp;
    const intakeFlow = rpmFrac * (0.15 + 0.85 * t1) * (turbo ? 0.4 : 1);
    // overrun burble: a performance calibration keeps a little fuel flowing with the spark
    // retarded, and it lights in the hot manifold. Strongest just after lift-off, from a hot
    // exhaust, high in the revs; gone by idle.
    if (overrun && !this.wasOverrun) this.lift = 1;
    else if (overrun) this.lift *= Math.exp(-dt / BURBLE_S);
    else this.lift = 0;
    this.wasOverrun = overrun;
    const burble = a.crackle ? Math.max(cfg.overrun, BURBLE_FAINT) : 0;
    const high = clamp((r1 - 1.3 * cfg.idleRpm) / (0.35 * cfg.redlineRpm), 0, 1);
    const rate = BURBLE_RATE * burble * high * (0.25 + 0.75 * this.lift) * (0.5 + 0.5 * this.heat);
    // per exhaust event: n events every two revolutions
    const burbleP = overrun ? Math.min(0.5, (rate * 120) / (Math.max(r1, 1) * n)) : 0;
    // on the limiter about half the events are cut; pops there at a third of the lift-off rate
    const limiterP = Math.min(
      0.5,
      ((BURBLE_RATE / 3) * burble * (0.5 + 0.5 * this.heat) * 240) / (Math.max(r1, 1) * n),
    );
    const mixEx = cfg.mix.exhaust;
    const mixIn = cfg.mix.intake;
    const mixMech = cfg.mix.mechanical;
    // the turbos are heard through the same silencing as the intake and exhaust they sit in: a
    // quiet car quietens them too (1.1 = the default intake + exhaust mix)
    const turboMix = (mixIn + mixEx) / 1.1;
    // a turbine between the ports and the pipe breaks the blowdown jets up
    const jet = turbo ? 0.5 * JET : JET;
    const mechScale = rpmFrac * rpmFrac * this.sizeAmp;
    // combustion noise follows how hard and how fast the pressure rises: a light-load idle burns
    // softly, a full-load pull rattles
    const knockLevel = 0.2 * (0.15 + 0.85 * load) * Math.sqrt(rpmFrac);
    const G = cfg.groupCount;
    const { evo, evc, ivo, ivc, openDeg, valves } = this.ports;
    const [ex0, ex1] = this.ports.exhaustStroke;
    const [in0, in1] = this.ports.intakeStroke;

    for (let k = 0; k < len; k++) {
      const rpm = running ? (r0 + ((r1 - r0) * (k + 1)) / len) * (1 - 0.03 * this.sag) : 0;
      this.sag += ((limCut ? 1 : 0) - this.sag) * this.kSag;
      const dDeg = (rpm * 6) / fs;
      let phi = this.phi + dDeg;
      if (phi >= 720) phi -= 720;
      this.phi = phi;

      for (let i = 0; i < this.pipes.length; i++) this.pipes[i].pop(this.w);
      if (this.popCount > 0) this.firePops();

      // ── cylinders ──
      let srcSum = 0;
      let intakeSrc = 0;
      let ticks = 0;
      for (let i = 0; i < n; i++) {
        let th = phi - this.fire[i];
        if (th < 0) th += 720;
        const prev = this.prevTheta[i];
        this.prevTheta[i] = th;
        if (dDeg > 0 && th < prev) {
          // firing TDC: the ECU decides what happens in this cylinder's cycle
          const t = this.t - th / dDeg;
          let fuel: number = Fuel.Burn;
          if (antiLag) fuel = Fuel.AntiLag;
          else if (overrun || limCut || !running) fuel = Fuel.Cut;
          this.fuel[i] = fuel;
          if (fuel === Fuel.Burn) {
            // no two cylinders breathe and burn quite alike (fixed per cylinder, golden-ratio spread)
            const own = 1 + IMBALANCE * (2 * ((i * 0.6180339887 + 0.37) % 1) - 1);
            this.charge[i] =
              burnAmp * own * this.fill[i] * Math.max(0.2, 1 + sigma * this.rng.gauss());
            this.knock.trigger(this.charge[i]);
          } else if (fuel === Fuel.AntiLag) {
            // retarded ignition: weak in-cylinder push, the rest burns in the manifold
            this.charge[i] = 0.4 * burnAmp;
            this.knock.trigger(0.5 * this.charge[i]);
          } else if (overrun && burble > 0) {
            // a burble calibration: a little fuel, spark retarded, burning late into the pipe
            this.charge[i] =
              (FUEL_CUT + BURBLE_FUEL * burble * high * (0.4 + 0.6 * this.lift)) * this.sizeAmp;
          } else this.charge[i] = FUEL_CUT * this.sizeAmp;
          this.events?.push({ kind: fuel === Fuel.Cut ? 'cut' : 'fire', cyl: i, t });
        }
        if (prev < evo && th >= evo) {
          const t = this.t - (th - evo) / dDeg;
          const g = this.cylGroup[i];
          turbo?.pulse(this.charge[i]);
          const delay = this.headers[i].delay;
          if (this.fuel[i] === Fuel.AntiLag && this.rng.next() < 0.4) {
            const amp = (2.5 + 2 * this.rng.next()) * burnAmp;
            this.schedulePop(t + delay + this.rng.next() * 0.002 * fs, amp, g, Pop.Bang);
            this.events?.push({ kind: 'bang', cyl: i, t });
          } else if (this.fuel[i] === Fuel.Cut && overrun && this.rng.next() < burbleP) {
            // late, irregular: the mixture lights somewhere down the pipe
            const amp =
              BURBLE *
              burble *
              (0.6 + 0.9 * this.rng.next()) *
              this.sizeAmp *
              (0.5 + 0.5 * high) *
              (0.7 + 0.6 * this.heat);
            this.schedulePop(t + delay + this.rng.next() * 0.012 * fs, amp, g, Pop.Burble);
            this.events?.push({ kind: 'crackle', cyl: i, t });
          } else if (
            this.fuel[i] === Fuel.Cut &&
            running &&
            !overrun &&
            this.rng.next() < limiterP
          ) {
            // bouncing off the limiter: the cut cylinders' fuel lights in the hot pipe, the same
            // low pops as the overrun (sparser: the throttle is open, the pipe is full of gas)
            const amp = BURBLE * burble * (0.6 + 0.9 * this.rng.next()) * this.sizeAmp;
            this.schedulePop(t + delay + this.rng.next() * 0.012 * fs, amp, g, Pop.Burble);
            this.events?.push({ kind: 'crackle', cyl: i, t });
          }
        }
        if (valves && ((prev < evc && th >= evc) || (prev < ivc && th >= ivc))) ticks++;
        // valve overlap: whatever pressure the manifold holds now stays in the cylinder as
        // exhaust gas and dilutes the next charge
        if (th > evc - 60 && th <= evc) {
          this.overlapP[i] += this.manifold[this.cylHead[i]];
          this.overlapN[i]++;
        } else if (prev <= evc && th > evc && this.overlapN[i] > 0) {
          const p = Math.max(0, this.overlapP[i] / this.overlapN[i]);
          this.overlapLast[i] = p;
          this.overlapP[i] = 0;
          this.overlapN[i] = 0;
          // only differences between collector-mates matter: an evenly fed collector leaves
          // every cylinder the same
          let ref = 0;
          let m = 0;
          for (let c = 0; c < n; c++)
            if (this.cylHead[c] === this.cylHead[i]) {
              ref += this.overlapLast[c];
              m++;
            }
          ref /= m;
          this.fill[i] = ref > 1e-9 ? clamp(1 - (RESIDUAL * (p - ref)) / ref, 0.6, 1.4) : 1;
        }

        // exhaust valve: emptying cylinder against the port pressure
        const h = this.headers[i];
        let rv = R_VALVE_CLOSED;
        let s = 0;
        if (th > evo && th < evc) {
          let area: number;
          if (openDeg > 0) {
            // a rotor flank sweeping across the port edge: open in a few degrees, then wide open
            area = Math.min(1, (th - evo) / openDeg, (evc - th) / openDeg);
          } else {
            const lift = bump((th - evo) / (evc - evo));
            area = lift > 0.35 ? 1 : lift / 0.35;
          }
          rv = R_VALVE_CLOSED + (R_VALVE_OPEN - R_VALVE_CLOSED) * area;
          const port = h.out0 * (1 + rv);
          const q = area * Math.max(0, this.charge[i] - BACKPRESSURE * port);
          this.charge[i] = Math.max(0, this.charge[i] - (q * this.blowRate) / fs);
          s = q;
          this.jet[this.cylGroup[i]] += q * q;
          this.headFlow[this.cylHead[i]] += q;
          // exhaust stroke: the piston pushes the rest out
          if (th > ex0 && th < ex1) s += pumpAmp * area * bump((th - ex0) / (ex1 - ex0));
        }
        h.in0 = rv * h.out0 + s;
        srcSum += s;

        // intake valve: the suction pulse (its hiss follows it, below)
        if (th > ivo && th < ivc) {
          const lift = bump((th - ivo) / (ivc - ivo));
          if (th > in0 && th < in1) intakeSrc -= lift * bump((th - in0) / (in1 - in0));
        }
      }

      // ── afterfire + turbulent flow noise enter at the collectors; the blowdown jets hiss in
      // their own collector's rhythm (sparse bursts for an I4, a steady rush for a V12) ──
      for (let g = 0; g < G; g++) {
        const j = this.collectorJ[g];
        j.src =
          this.bang[g].next() +
          this.burble[g].next() +
          this.burst[g] * this.rng.bi() +
          flowNoise * this.roarLp[g].run(this.rng.bi()) +
          ((jet * this.jet[g]) / this.sizeAmp) * this.jetHp[g].hp(this.rng.bi());
        this.jet[g] = 0;
        this.burst[g] *= this.kBurst;
      }
      for (let j = 0; j < this.junctions.length; j++) this.junctions[j].scatter();
      // each manifold fills with its own head's blowdowns and empties down the pipe
      for (let h = 0; h < this.manifold.length; h++) {
        this.manifold[h] += (this.headFlow[h] - this.manifold[h]) * this.kManifold;
        this.headFlow[h] = 0;
      }

      // ── terminations ──
      let exL = 0;
      let exR = 0;
      for (let g = 0; g < G; g++) {
        const tail = this.tails[g];
        const refl = -0.75 * this.openLp[g].lp(tail.out1);
        tail.in1 = refl;
        // near the tailpipe the pressure follows the outflow (volume velocity = area × velocity),
        // not its derivative
        const flow = this.radHp[g].hp(tail.out1 - refl);
        const can1 = this.canLp[g].lp(flow);
        const can = cfg.mufflerPoles === 2 ? this.canLp2[g].lp(can1) : can1;
        const rad = RADIATE_GAIN * tail.area * (can + cfg.mufflerLeak * (flow - can));
        const hp = this.earHp[g].run(rad);
        const lo = rad - hp;
        exL += this.gLo[g] * lo + this.gL[g] * hp;
        exR += this.gLo[g] * lo + this.gR[g] * hp;
        if (probe?.groups) probe.groups[g][k] = rad;
        const res = this.resonators[g];
        res.in1 = 0.95 * res.out1;
      }
      const ip = this.intake;
      ip.in0 = 0.9 * ip.out0 + 0.5 * intakeFlow * this.sizeAmp * intakeSrc;
      const ir = -0.85 * this.intakeLp.lp(ip.out1);
      ip.in1 = ir;
      // air rushing past the intake valves: hiss in step with each cylinder's suction
      const noise = this.intakeNoise.run(this.rng.bi()) * -intakeSrc * intakeFlow * INTAKE_HISS;
      const intake = this.intakeHp.hp(ip.out1 - ir) + noise;

      for (let i = 0; i < this.pipes.length; i++) this.pipes[i].push(this.w);
      this.w = (this.w + 1) & INDEX_MASK;

      // ── block ──
      let mech = 0;
      for (let o = 0; o < this.orderK.length; o++)
        mech += this.orderLvl[o] * Math.sin(this.orderK[o] * phi * DEG);
      mech *= mechScale;
      mech += 0.15 * load * mechScale * Math.sin(this.firingOrder * phi * DEG);
      mech = this.mechLp.lp(mech) + knockLevel * this.knockBand.run(this.knock.next());
      mech +=
        (cfg.ohv ? 0.06 : 0.03) *
        Math.sqrt(rpmFrac) *
        this.tick.run(ticks * (0.7 + 0.6 * this.rng.next()));

      const tb = turbo ? turbo.sample(a) : 0;
      const center = (mixIn * intake + mixMech * mech + tb * turboMix) * Math.SQRT1_2;
      let yl = this.dcL.hp(mixEx * exL + center) * cfg.gain;
      let yr = this.dcR.hp(mixEx * exR + center) * cfg.gain;
      if (!Number.isFinite(yl + yr)) {
        this.reset();
        yl = yr = 0;
      }
      const lim = this.limiter.gain(yl, yr);
      L[k] = yl * lim;
      R[k] = yr * lim;
      if (probe?.source) probe.source[k] = srcSum;
      if (probe?.mechanical) probe.mechanical[k] = mech;
      if (probe?.turbo) probe.turbo[k] = tb * turboMix;
      this.t++;
    }
  }

  /** Last-resort recovery if anything ever blows up: silence every pipe. */
  private reset() {
    for (const p of this.pipes) p.clear();
    this.charge.fill(0);
    // and every filter state a bad value could have reached through them
    this.jet.fill(0);
    this.manifold.fill(0);
    this.headFlow.fill(0);
    this.overlapP.fill(0);
    this.overlapN.fill(0);
    this.overlapLast.fill(0);
    this.fill.fill(1);
    for (const f of [...this.canLp, ...this.radHp, ...this.openLp, ...this.jetHp]) f.y = 0;
    for (const b of this.earHp) b.reset();
  }
}
