# Apex: how cars are laid out, in 3D

A front-end-only site on GitHub Pages (`magetron.github.io/apex/`) that explains car layouts, drivetrains and engines through interactive 3D: exploded views, animated engines, a handling simulator and synthesized engine sounds.

**Audience and purpose:** an educational tool for students. Every scene should answer *where is it, why did the engineers put it there, and what does that do to handling, space and cost?* Comparisons beat single cars: GTI vs Golf R, BMW 3 Series vs Audi quattro, 911 vs Cayman, Fiat 500 old vs new, G-Class vs crossover.

This document is the blueprint. It fixes the **shared contracts** (data model, scene API, file ownership) so that several agents can build components in parallel without stepping on each other.

---

## 1. What the visitor gets: one page, one car, zoom in and out

There are no separate pages. The 3D scene *is* the site, and the HUD floats minimally in its corners. A car is the point of entry, and you explore by clicking into it. The camera flies fluidly between levels, and anything outside the current focus stops rendering.

| Level | URL hash | What you see | How you get there / out |
|---|---|---|---|
| **Car** (entry) | `#/<car>` | The look-alike exterior in its signature paint | default · Esc from inside / drive |
| **Inside** | `#/<car>/internals` | X-ray body: drivetrain, CG roundel, torque flow, explode, engine-swap fit check | click the car · Esc from a part |
| **Part** | `#/<car>/<part>[/<detail>]` | One component (engine, gearbox, diff, motor, battery…) isolated, exploded and animated. The engine adds firing order, balance visualiser and live sound | click a part when inside · Esc / empty-space click backs out |
| **Drive** | `#/<car>/drive` | The *same* car driving and cornering through scripted scenarios, with ghost cars of other layouts, settings in the hub | **Drive** button · Esc |

- **HUD:** trail (top-left: `Porsche 911 › Inside › Flat-6`) · info card (top-right: chips and numbers) · settings hub (bottom-left: explode, labels, engine speed, sound, drive scenario) · car strip (bottom-centre: switching cars *morphs* the layout in place).
- **Deep links and the back button just work**, because the hash is the state. Tours (§6) are sequences of these same views with a short caption each.
- **Show, don't tell.** Text is either a label anchored to the 3D part it names, or derived from the spec data (chips, stats). There are no free-floating paragraphs that can go stale. Tour captions are ≤ ~60 words and only describe what's on screen.
- **Dark and light themes** (toggle in the top bar, OS default). Every view must work in both.

Design language is "engineering x-ray": blueprint ground, fresnel-glass body shells in the inside view, and one **system color legend used everywhere**:

| System | Color |
|---|---|
| Engine / combustion | amber |
| Gearbox / transaxle | blue |
| Shafts (prop, half) | yellow |
| Diffs / couplings | magenta |
| Driven wheels | green glow (undriven wheels stay grey) |
| EV battery / motors | teal / cyan |
| Occupants & luggage volume | translucent white |
| Centre of gravity | classic black/white CG roundel |

---

## 2. Key decisions (defaults; push back if you disagree)

1. **Stack: Vite + React + TypeScript + React Three Fiber (three.js) + drei + zustand.** R3F keeps the scene declarative, and React is a good fit for the UI panels. Per-frame animation goes through `useFrame` with refs, so it never triggers React re-renders. Vitest for unit tests, plus an optional Playwright smoke test that screenshots each route.
2. **Everything is our own procedural geometry; cars are recognisable look-alikes, not replicas.** Engines *must* be parametric anyway, because the same spec drives geometry, animation, balance and sound. Car bodies are lofted shells tuned per car until a student instantly recognises it: proportions, wheelbase and overhangs, plus the signature features (911 teardrop roofline, G-Class box with upright glass, Smart's tall stub, R8 side blade). Pixel accuracy is explicitly **not** a goal; we don't contact car makers (the school can later, if the project takes off). **Optional photoreal bodies (WP9, low priority)** plug into a `BodyProvider` seam (`procedural` | `gltf`), with the procedural shell always the fallback. Rules if we ever use downloaded glTF bodies:
   - The **3D model file** is the modeller's copyright, separate from the car maker's design. So use only CC0 or CC-BY models (or ones with the modeller's written permission). Never game rips (Forza, GT, Assetto), however they are labelled.
   - Badges are fine (non-profit education). Never show cars damaged or crashed.
   - Draco/meshopt-compressed, ≤ ~8 MB each, lazy-loaded.
   - Every model credited in `public/models/CREDITS.md` and on the About page, with a short non-profit, educational-use statement.

   The car makers' design and trademark risk is minimal for a non-profit teaching site. The worst realistic case is a takedown request, which we can answer by flipping that car back to its procedural shell.
3. **One spec drives everything.** An `EngineSpec` produces the 3D engine, its crank animation, firing events (which feed the sound synth), balance forces and its bounding box (which feeds the fit check). A `VehicleSpec` plus its components produces derived mass properties (weight split, CG height, yaw inertia), which feed the readouts and the handling sim. **Weight distribution is computed, never typed in**, and it is unit-tested against published figures.
4. **Sound is synthesized, not sampled.** An AudioWorklet runs a physically informed waveguide model: firing pulses → per-cylinder headers → collectors → muffler, plus intake and block vibration. This follows Baldan et al. 2015, which DasEtwas/enginesound (MIT, Rust) and Antonio-R1/engine-sound-generator (MIT, JS) also implement. Firing timing comes from the engine spec, so a crossplane V8 burbles and a boxer rumbles *because of the geometry*, not because of per-engine hacks.
5. **Handling sim is a small deterministic model** in pure TS: a single-track (bicycle) model with longitudinal load transfer, load-sensitive tires and a friction ellipse on the driven axle. That is the minimum needed to reproduce FF power-understeer, RWD power-oversteer, RR lift-off oversteer and MR's fast yaw response. A twin-track upgrade is a stretch goal.
6. **Real cars by name.** This is a non-profit teaching tool that shows no crash or damage, so naming and depicting real models (Porsche 911, BMW Z4 G29…) is in scope. The car makers' side of the legal risk is minimal. Vehicle ids are real-model slugs (`porsche-911-992`, `audi-r8-v10-gen2`).
7. **One persistent `<Canvas>`** for the whole app. Routes swap scene contents and tween the camera rather than creating new WebGL contexts. **Hash routing** sidesteps GitHub Pages' SPA 404 problem, and Vite uses `base: '/apex/'`.
8. **No runtime network dependencies.** Bundle a small HDR or use drei `Lightformer`s, because drei's `Environment` presets fetch from a CDN. Self-host fonts.

---

## 3. Architecture

```
                         ┌──────────────────────────────┐
                         │  src/spec   (pure TS, tested) │
                         │  types · catalog · derive/*   │
                         │  ─ cylinders(), kinematics    │
                         │  ─ firingEvents(), balance()  │
                         │  ─ envelope(), massProps()    │
                         └──────┬─────────┬────────┬─────┘
             EngineSpec/derived │         │        │ VehicleSpec/massProps
          ┌─────────────────────┘         │        └───────────────────┐
          ▼                               ▼                            ▼
 ┌─────────────────┐            ┌──────────────────┐          ┌─────────────────┐
 │ src/engine3d    │◀──engine───│ src/vehicle3d    │          │ src/sim         │
 │ parametric      │  model     │ body shell,      │          │ bicycle model + │
 │ engine + anim + │            │ chassis, drive-  │          │ top-down view   │
 │ balance viz     │            │ train placement, │          │ + plots         │
 └───────┬─────────┘            │ torque flow, fit │          └────────┬────────┘
         │ firing events        └────────┬─────────┘                   │
         ▼                               │                             │
 ┌─────────────────┐                     │                             │
 │ src/audio       │                     │                             │
 │ AudioWorklet    │                     │                             │
 │ engine + EV     │                     │                             │
 └───────┬─────────┘                     │                             │
         └──────────────┬────────────────┴─────────────┬───────────────┘
                        ▼                              ▼
              ┌───────────────────┐          ┌───────────────────────┐
              │ src/scene         │          │ src/tours + content   │
              │ <Part>, explode,  │◀─────────│ TourStep → scene cfg  │
              │ labels, x-ray,    │          │ scrolly player        │
              │ camera rig, store │          └───────────────────────┘
              └───────────────────┘
                        ▲
              ┌───────────────────┐
              │ src/app  shell,   │
              │ routes, Canvas,   │
              │ UI kit, settings  │
              └───────────────────┘
```

### Repo layout and ownership

```
apex/
  index.html · vite.config.ts · tsconfig.json · package.json      (lead)
  .github/workflows/pages.yml · scripts/env.{sh,ps1}               (lead)
  src/
    app/              shell, hash router, persistent Canvas, UI kit, theme CSS   (lead)
    scene/            Part/Assembly explode, labels, materials, camera, store,
                      registry (id → object), theme, runtime (engine + vehiclePose) (lead)
    spec/             types.ts (THE CONTRACT), units, builders, describe,
                      derive/ (kinematics, firing, balance, envelope, layout, mass) (lead)
      catalog/engines/*.ts, motors/*.ts, vehicles/*.ts  one file per entry       (WP6 fills)
    explorer/         the one page: view.ts (hash ⇄ zoom state), index.tsx (scene +
                      picking), FocusCamera, Hud, VehicleSlot                    (lead)
      panels/CarInfo.tsx, PartInfo.tsx                                           (WP3)
      panels/EngineInfo.tsx, EngineControls.tsx                                  (WP2)
      drive/DriveScene.tsx, DriveControls.tsx, DriveInfo.tsx                     (WP5)
    engine3d/         parametric engine + EV motor models, animation, balance viz (WP2)
    vehicle3d/        look-alike bodies, chassis, drivetrain, torque flow, fit    (WP3)
    audio/            worklet DSP, EV synth, turbo/anti-lag, SoundPanel           (WP4)
    sim/              model/ (pure TS), scenarios/                                (WP5)
    content/          types.ts (lead) · tours/*.ts, glossary.ts                  (WP6)
    tours/            tour player (drives the explorer)                           (WP7)
    proto/            THROWAWAY Phase 0 slice (ProtoCar/ProtoEngine)             (lead; deleted at integration)
    dev/              #/dev/<module> sandboxes, one file per WP                   (each WP its own)
```

Each WP builds and demos in its own **`#/dev/<module>` sandbox** (auto-discovered), then plugs into the explorer through its panel/slot files. The lead switches `explorer/VehicleSlot.tsx` from ProtoCar to WP3's model and wires WP2's engine into it at integration.

---

## 4. The contract (`src/spec/types.ts`, sketch)

Units: specs are in **mm / kg / degrees**; the scene is in **metres**. Vehicle frame: **+X forward, +Y up, +Z right**, origin on the ground at the front axle centre (rear axle at `x = −wheelbase`). Engine-local frame: crank axis = +X, the "up" cylinder direction = +Y.

```ts
// ── Engines ──────────────────────────────────────────────
type EngineFamily = 'inline' | 'v' | 'flat' | 'vr' | 'w' | 'rotary' | 'electric';

interface CylinderDef {
  bank: number;          // index into banks[]
  axialMm: number;       // position along crank axis
  throwDeg: number;      // crankpin angle (defines crossplane/flatplane/split pins)
}
interface BankDef {
  tiltDeg: number;       // cylinder axis angle from vertical (V: ±θ/2, flat: ±90, VR: ±7.5)
  head: number;          // which cylinder head (VR banks share one head)
}

interface EngineSpec {
  id: string; name: string; family: EngineFamily;
  examples: string[];                 // "BMW B58", "Porsche 9A2"
  boreMm: number; strokeMm: number; rodMm: number; borePitchMm: number;
  banks: BankDef[]; cylinders: CylinderDef[];
  firingOrder: number[];              // 1-based cylinder numbers
  valvetrain: { type: 'ohv' | 'sohc' | 'dohc'; valvesPerCyl: number };
  induction: 'na' | 'turbo' | 'twin-turbo' | 'quad-turbo' | 'supercharged';
  idleRpm: number; redlineRpm: number; massKg: number;
  sound: EngineSoundParams;           // header lengths/equal-unequal, collector, muffler, mix
  blurb?: string;                     // filled by content (WP6)
}
// Builders keep catalog files short: inline(4, {...}), vee(8, 90, 'crossplane', {...}),
// flat(6, ...), vr(6, 15, ...), w(16, 90, 15, ...)

interface MotorSpec { id: string; kind: 'pmsm' | 'induction'; peakKw: number;
  reduction: number; maxRpm: number; massKg: number; sound: EvSoundParams; }

// ── Vehicles ─────────────────────────────────────────────
type EnginePos   = 'front-overhang' | 'front-mid' | 'mid' | 'rear-overhang' | 'rear-underfloor';
type Orientation = 'longitudinal' | 'transverse';
type Gearbox     = 'inline' | 'transverse-endon' | 'rear-transaxle' | 'mid-transaxle';
type Driven      = 'front' | 'rear' | 'all';
type AwdKind     = 'clutch-on-demand' | 'center-diff' | 'rear-biased-clutch'
                 | 'transaxle-ptu' | 'dual-motor';

interface VehicleSpec {
  id: string; name: string; archetype: string; examples: string[];
  dims: { wheelbaseMm; trackFMm; trackRMm; lengthMm; widthMm; heightMm; overhangFMm; rideMm };
  body: BodyProfile;                  // hood/cabin/tail params for the procedural shell
  bay: { widthMm: number; lengthMm: number };   // free engine-bay envelope (fit check)
  powertrain: {
    engine?: string; motors?: { motor: string; axle: 'front' | 'rear' }[];
    position: EnginePos; orientation: Orientation; engineXMm: number;  // engine CG x
    gearbox: Gearbox; driven: Driven; awd?: AwdKind;
    battery?: { kWh: number; massKg: number; footprint: [number, number] };
  };
  seats: { layout: '2' | '2+2' | '4' | '5'; rows: number };
  luggageL: { front?: number; rear?: number };
  masses: ComponentMass[];            // body, engine, gearbox, fuel, battery, occupants…
  published: { curbKg: number; frontPct?: number; source?: string };  // for validation
  tires: { widthFMm; widthRMm; mu: number };
}

// ── Derived (src/spec/derive) ────────────────────────────
pistonPos(theta, spec)        // exact slider-crank
firingEvents(spec)            // [{cyl, crankDeg}] over 720°, derived from throws + tilt + order
balance(spec)                 // 1st/2nd-order free forces & couples, computed numerically
envelope(spec)                // L×W×H of block + heads + manifolds
massProps(vehicle)            // total kg, CG xyz, front %, Izz (yaw inertia)
```

`balance()` sums the reciprocating-mass accelerations for every cylinder over a crank cycle, then reads off the 1st- and 2nd-order components. Because it is numeric and general, it handles I3 through W16 without lookup tables. Results are reported *before* counterweighting, with a flag for which terms counterweights can cancel.

---

## 5. Work packages

Phases: **0 = sequential foundation** (lead or one agent) → **1 = parallel fan-out** (5 agents) → **2 = integration and polish**.

> **Status:** Phase 0 (WP0 + WP1) is done. The explorer shell, scene framework, spec core, catalog seeds, 70+ tests and a throwaway ProtoCar/ProtoEngine slice all run end to end. The "page" wording in the WPs below is superseded by §1: every WP now delivers **components plus explorer panel/slot files**, never pages.

### WP0 — Foundation and contracts *(phase 0 — done)*
- Vite/React/TS/R3F scaffold, `base: '/apex/'`, hash router, persistent Canvas, lazy-loaded routes.
- GitHub Actions Pages deploy (`upload-pages-artifact` + `deploy-pages`), lint, Vitest, `.gitignore` (include `*.un~`).
- `src/spec/types.ts` as above, plus builder helpers.
- **Scene framework** (`src/scene`):
  - `<Part id system explode={{dir?, dist, stage}} label>`; `dir` defaults to "away from the assembly centroid".
  - Staged explode driven by one `explode ∈ [0,1]`.
  - Hover/select outline, `<PartLabel>` with leader lines.
  - X-ray / ghost materials, system-color palette.
  - `CameraRig` with named presets and tweening.
  - Zustand scene store: `explode, highlight[], xray, labels, timeScale, crankAngleRef`.
- UI kit: panel, segmented control, slider, legend, stat readout. Dark theme tokens.
- **Thin vertical slice** proving the pipeline: a primitive I4 that animates and explodes, and an FF car made of proxy boxes that explodes. Both are throwaway; they exist to validate the contracts.
- **Done when:** deployed to Pages, the `#/dev/scene` sandbox shows the explode working, and `types.ts` has been reviewed.

### WP1 — Spec core math *(phase 0 — done)*
- `derive/`: kinematics, `firingEvents`, `balance`, `envelope`, `massProps`.
- Seed catalog: `i4`, `i6`, `flat6`, `v8-cross`, `v10`, `ev-dual` and vehicles `hatch-ff`, `bmw-m340i-g20`, `porsche-911-992`, `audi-r8-v10-gen2`. Enough for the other WPs to develop against.
- **Test oracles** (these define "done"):
  - Even firing intervals: I3 240°, I4 180°, I5 144°, I6 120°, V8 90°, V10 72°, V12 60°, W16 45°. Crossplane V8 is uneven *per bank*; flatplane is even per bank.
  - Balance:
    - I6 and 60° V12 have no 1st/2nd-order forces or couples.
    - I4 has a 2nd-order vertical force only.
    - I3 has balanced forces but 1st- and 2nd-order rocking couples.
    - Flat-plane V8 has a 2nd-order *horizontal* force.
    - Crossplane V8's only term is a 1st-order rotating couple, which counterweights can cancel.
    - Flat-6 is essentially balanced.
  - `massProps` front % is within ±3 pts of published figures for the seed vehicles (~60% FF hatch, ~50% FR saloon, ~38–40% RR 911, ~42% MR).

### WP2 — Engines: parametric engine + EV motor models *(phase 1)*
- Generator `EngineSpec → <EngineModel detail="low|high">`.
  - Parts: block per bank with bores, liners, pistons, rods, crank (journals, pins at `throwDeg`, webs/counterweights), heads/cam covers, cams turning at ½ crank speed, valves, timing drive, intake plenum/runners, exhaust headers as tubes (lengths visible: equal vs unequal), turbos, flywheel, sump.
  - Must handle inline, V, flat, VR (shared head, staggered) and W (two VR banks).
- Animation: crank angle from the store's ref; combustion glow on firing; firing-order timeline scrubber; slow motion (visual time scale is independent of audio rpm).
- **Balance visualizer:** force/couple arrows and an exaggerated "engine shake" mode. Showing an I3 rocking, an I4 buzzing and an I6 sitting still is the money shot.
- EV motor model: stator, rotor, windings, inverter, reduction gear, diff (explodable).
- Explorer integration: the engine renders *in place inside the car* (origin = crank-axis centre, engine-local frame). When the explorer zooms into `engine`, the same object explodes and animates; nothing is re-mounted. Panels: `explorer/panels/EngineInfo.tsx` and `EngineControls.tsx`. Keep the sub-part ids `engine/crank`, `engine/pistons`, `engine/block`, `engine/head-<n>` (tours and highlights use them). Optional `detail` views (e.g. `#/<car>/engine/balance`).
- Engines: I3, I4, I5, I6, flat-4, flat-6, V6 (60°/90°/120°), VR6, V8 crossplane, V8 flatplane, V10, V12, W12, W16, EV motor. Rotary is a stretch goal.
- Prior art for UX only (closed source): [CrankLab](https://cranklab.mroy.dev/), an R3F procedural engine explorer. Our differentiators are exploded views, balance visualization and the car integration.
- Owns `src/engine3d/**`, `src/explorer/panels/Engine*.tsx`, `src/dev/engine.tsx`.

### WP3 — Vehicles: look-alike bodies + drivetrains *(phase 1)*
- **Body shell (first priority, the user's top visual concern):** each car must be *recognisable* at a glance. Not pixel-accurate, but clearly that car.
  - Build: loft cross-sections along X with plan-view taper and tumblehome, separate greenhouse/glass, wheel arches with flares, bumpers, light-cluster hints.
  - Signature lines per model: 911 teardrop roofline and round headlights, G-Class box with upright glass, Smart's tall stub, R8 side blade, Golf C-pillar, BMW kidney nose.
  - Extend `BodyProfile` via a lead-reviewed proposal if needed.
  - Materials: opaque paint at the car level, x-ray glass with edge lines inside.
  - Iterate visually in the browser against real proportions.
- **Chassis:** floor/subframes, wheels and tyres, discs, simplified struts/wishbones, steering rack, radiators (mid-engine cars have front radiators with long plumbing).
- **Drivetrain placement from spec:** engine (WP2's `<EngineModel>`, or an `envelope()` proxy box until WP2 lands), clutch/converter, gearbox per type, prop shaft, centre coupling or diff, front/rear diffs, halfshafts with CV joints, fuel tank, exhaust run, battery skateboard, e-motors. Also seat mannequins and luggage volumes.
- **Torque flow:** a path graph from crank to wheels, with animated dashes/particles, split % at diffs and couplings, and shafts spinning at correct relative speeds.
- **Explode stages:** (1) body lifts and fades → (2) interior rises → (3) powertrain separates → (4) wheels and suspension move out.
- **Layout morph:** switching a car's layout tweens components to their new positions.
- **Overlays:** CG roundel, axle-load bars, dimension lines, "dumbbell" yaw-inertia visual, top-down cabin vs drivetrain floor plan.
- **Engine swap and fit check:** drop any engine in, oriented per layout. The engine envelope plus gearbox is checked against `bay`, and clashes turn red. Example: try a V8 transverse in a Golf. This directly answers "how does a transverse engine limit engine size".
- Explorer integration: `<VehicleModel vehicle level part>` with the same props as `ProtoCar`, which the lead swaps into `explorer/VehicleSlot.tsx`.
  - Behaviour per level: paint at `car`/`drive`, ghost at `internals`; explode only at `internals`; the zoomed part's own assembly explodes at `part`.
  - Every component wrapped in a `<Part>` with its layout id, plus an invisible envelope hit box so it is easy to click from the inside view.
  - Panels: `explorer/panels/CarInfo.tsx`, `PartInfo.tsx`.
- Owns `src/vehicle3d/**`, `src/explorer/panels/{CarInfo,PartInfo}.tsx`, `src/dev/vehicle.tsx`.

### WP4 — Sound Lab: engine synthesis *(phase 1, needs only types plus `firingEvents`)*
- AudioWorklet DSP written in TS. Verify Vite's worklet bundling (`?url` / `new URL(..., import.meta.url)`) early.
- Signal path: firing pulses (timing from `firingEvents`, amplitude from load and displacement) → per-cylinder header waveguides (length from `sound` params) → bank collectors → muffler resonators → tailpipe. Plus intake (filtered noise gated by intake events), block vibration (rpm-locked harmonics), optional turbo whistle and blow-off, and a rev-limiter cut.
- EV synth: motor electrical order × rpm, inverter switching whine, gear whine, optional AVAS tone.
- Controls: start/idle, rpm, throttle, auto-rev sweep. An "A/B" mode compares two engines.
- **Add-ons (welcome):** turbo spool whine (pitch ∝ shaft speed, lagging throttle), wastegate chatter, blow-off/dump valve on lift, **anti-lag** bangs and pops (retarded ignition → afterfire bursts in the collector), and overrun crackle. Each is a toggle in `<SoundPanel>`, with parameters in `EngineSoundParams.turbo?`.
- **Characters to hit by ear:** crossplane V8 burble, flatplane V8 shriek, unequal-header boxer rumble, I5 warble, I6 smoothness, V10/V12 howl, I3 thrum, W16 whoosh.
- Exports `<SoundPanel engine>` and `useEngineAudio(spec, rpmRef, throttleRef)`.
- References (MIT): [DasEtwas/enginesound](https://github.com/DasEtwas/enginesound) (Rust; port the algorithm), [Antonio-R1/engine-sound-generator](https://github.com/Antonio-R1/engine-sound-generator) (Web Audio). Background: Baldan & Delle Monache 2015, and [ange-yaghi/engine-sim](https://github.com/ange-yaghi/engine-sim) (MIT, C++; inspiration only, too heavy to port).
- Audio starts only on a user gesture. Master limiter, volume, mute persisted.
- Explorer integration (done): the hub owns one `useEngineAudio` voice for the whole visit. Every level shows a speaker on/off and volume; the engine (or motor) view adds the gas pedal (hold the button or Space), blip, sweep and add-ons under the engine-speed slider. Drive starts the sound and the sim drives `engineRuntime` rpm/throttle.
- Owns `src/audio/**`, `src/dev/audio.tsx`.

### WP5 — Drive mode: vehicle-dynamics sim *(phase 1, needs `massProps`)*
- `sim/model`: deterministic fixed-step (e.g. 240 Hz) single-track model.
  - States `vx, vy, r`; inputs steer, throttle, brake.
  - Axle loads from `massProps` plus longitudinal transfer `m·ax·h/L`.
  - Pacejka-lite tires with load sensitivity; friction ellipse on driven axle(s).
  - AWD torque split, simple ESC toggle.
- `sim/scenarios`: skidpad ramp (understeer gradient plot), power-on exit, lift-off mid-corner, lane change, straight-line braking. Inputs are **scripted only**, so layouts compare fairly. There is no free-drive mode: this is an explainer, not a game. Visitors control scenario, layouts, speed and playback (play, pause, scrub, slow-mo).
- **Drive mode in the explorer, in 3D, not a separate canvas.** `explorer/drive/DriveScene.tsx` steps the sim and writes `vehiclePose` (scene/runtime) every frame, so the *same* car model drives, rolls and pitches.
  - Draws the road or cones, the trail, tyre force arrows and friction circles at the wheels, and optional ghost cars of other layouts.
  - Chase camera.
  - Settings in `DriveControls.tsx` (hub, bottom-left): scenario, speed, ghosts, play/pause/slow-mo. Live numbers in `DriveInfo.tsx` (lateral g, yaw rate, axle loads), with tiny sparkline plots at most.
- **Tests:** sign of the understeer gradient per layout; RR shows a bigger yaw spike on lift-off than FR; FF shows power-understeer; determinism.
- Reference: [spacejack/carphysics2d](https://github.com/spacejack/carphysics2d) (MIT, Marco Monster's tutorial in JS).
- Owns `src/sim/**`, `src/explorer/drive/**`, `src/dev/sim.tsx`.

### WP6 — Content and catalog *(phase 1, research-heavy)*
- Fill `catalog/engines/*` and `catalog/vehicles/*` with real-world-plausible numbers: bore/stroke/pitch, masses, dims, published weight split. **Each number gets a source comment**; anything estimated is marked `~`.
- Write blurbs, a glossary (polar moment, understeer gradient, transaxle, Haldex, crossplane …) and the tour scripts in §6.
- Accuracy notes the content must get right, e.g.:
  - The Smart ForTwo and Renault Twingo III are RR; the classic Fiat 500 was RR, the modern one is FF.
  - VW's VR6 exists *to fit a 6 transversely*.
  - Audi's I5 is transverse in the RS3.
  - The Lotus Elise and Toyota MR2 are transverse mid-engined.
  - Audi longitudinal engines sit ahead of the front axle; BMW's sit behind it.
  - The GT-R uses a rear transaxle with a second prop shaft forward.
- Owns `src/content/**`, catalog entries (not `types.ts`).

### WP7 — Tours and explorer polish *(phase 2)*
- Tour player: a compact caption card (step dots, next/prev) that drives the explorer, since each `TourStep.scene.view` is just an explorer view. Tours live at `#/tour/<id>/<step>`, with a "Questions" entry point in the HUD. Contract: `src/content/types.ts`.
- Explorer feel:
  - Fade (not pop) parts in and out when isolating.
  - Semantic zoom: dollying far out of a part backs out a level.
  - Hover affordances ("this is clickable"), a first-visit coach mark, and transition timing.
- Owns `src/tours/**`, plus explorer polish PRs reviewed by the lead.

### WP8 — Polish, performance, QA *(phase 2)*
- Adaptive DPR / `PerformanceMonitor`, quality presets, instancing/merging, low-detail engines inside cars.
- Bundle budget: initial load ≤ ~400 kB gzip, labs lazy-loaded.
- Mobile touch controls, reduced motion, keyboard navigation, text alternatives for every visual claim.
- Playwright screenshot smoke test per route; Lighthouse pass; cross-browser audio check (Safari worklet quirks).

### WP9 — Detailed model bodies *(in progress — every car gets one; procedural shells are being retired)*
- Models: Ddiaz Design on Sketchfab, CC BY-NC-SA 4.0, credited on the About page (from `src/vehicle3d/gltf/cars/*.ts`) and in `public/models/LICENSE.md`. Pipeline: docs/DEVELOPING.md → Car models.
- Converter (`#/dev/convert`): geometric wheel detection (corners by centroid, mirrored if missing), per-material roles, spec-wheelbase alignment, hub-pivoted wheels, tyre split by radius. `scripts/models/optimize.mjs`: weld + meshopt, no triangles removed (simplifying crumpled glossy panels); models keep their own paint. Measured body profiles (`src/vehicle3d/gltf/profiles/`) place the cabin, seats and luggage.
- Runtime: `useCarModel` with byte progress → a progress bar while loading (no procedural stand-in), retry on failure, camera reframes when the model arrives.
- Still to do: contract support for hybrids (V60 T8, Avalon, Tourbillon) and rotary (RX-8), then delete the procedural shell path.

### Dependency summary

```
WP0 ──▶ WP1 ──┬──▶ WP2 (engines) ──┐
              ├──▶ WP3 (vehicles) ─┤  (uses WP2 model when ready; proxy box before)
              ├──▶ WP4 (sound)  ───┼──▶ WP7 (tours/pages) ──▶ WP8 (polish)
              ├──▶ WP5 (sim)    ───┤
              └──▶ WP6 (content) ──┘
```

Rules for parallel agents: edit only your own directories. Propose changes to `types.ts` or `src/scene` in your PR description rather than making them. Mount cross-WP components through their exported API only, e.g. WP2 mounts `<SoundPanel>` with a single import.

---

## 6. Launch tours (the questions this site exists to answer)

| Tour | Story beats (3D scene in brackets) |
|---|---|
| **Where's the engine in a Ferrari / Audi R8?** | [`audi-r8-v10-gen2` x-ray → body off] V10 sits longitudinally behind the seats and ahead of the rear axle. [explode powertrain] Transaxle behind the engine; on the R8/Huracán a prop shaft runs forward to a front coupling. [torque flow, rear-biased split] Contrast with the RWD Ferrari F8/296. |
| **Why does mid-engine handle best but leave no room for people?** | [dumbbell inertia overlay, MR vs FR vs RR] Mass near the centre gives low yaw inertia, so the car rotates quickly. [sim: lane change, MR vs FR] [floor-plan overlay] The engine occupies the rear-seat space: 2 seats, small frunk, heat and noise behind your head. [sim: lift-off] The flip side is that it also rotates quickly when it lets go. |
| **Why is a Porsche 911 (RR) tricky?** | [`porsche-911-992`, CG roundel well aft] The flat-6 hangs behind the rear axle (~38/62). Great traction and braking. [sim: lift-off mid-corner, RR vs MR] Lifting shifts load forward, the rear unloads, and the heavy tail swings like a pendulum. [overlays] How modern 911s tamed it: longer wheelbase, wide rear tyres, rear-steer, stability control. |
| **Why are hot hatches FF?** | [`vw-golf-gti-mk8` explode] Transverse engine and gearbox form one compact unit ahead of the front wheels: no tunnel, maximum cabin, cheap. [torque flow to front] Weight sits over the driven wheels. [sim: power-on exit] The limits: torque steer and power-understeer. |
| **How does a transverse engine limit engine size?** | [bay-fit overlay] Engine *length* plus gearbox has to fit *across* the bay, between the wheels and steering lock. [engine swap: I4 ✓ → I5 tight → I6 ✗ → VR6 ✓ (why it was invented) → V8 ✗] [zoom into the engine] Block length is roughly cylinders × bore pitch plus ends. |
| **Why is BMW's inline-6 + RWD the classic recipe?** | [zoom into the I6: balance view → perfectly still] Primary and secondary forces and couples cancel. [`bmw-m340i-g20`] A long engine is a natural fit longitudinally, sitting behind the front axle for ~50/50. RWD separates steering from driving, which keeps the steering pure. [compare with Audi's ahead-of-axle layout] |
| **How do AWD systems differ?** | Clutch-on-demand (Golf R) vs Torsen centre diff (quattro) vs transaxle and front PTU (GT-R) vs symmetrical (Subaru) vs dual-motor (EV). [torque-flow animation for each] |
| **Why do engines sound different?** | [zoom into engines + sound] Firing intervals per bank: crossplane vs flatplane V8, unequal-length boxer headers, I5 144°, the high-rpm V10 howl. |
| **What changes with an EV?** | [`tesla-model3-awd` explode] Skateboard battery and low CG, motors on the axles, single reduction, frunk, heavy but well distributed. [EV whine] |
| **Bonus: why is the Smart's engine in the back?** | [`smart-fortwo-brabus-451`] The shortest possible car with the most cabin: the engine goes under the boot floor. |

---

## 7. Catalog (initial target)

**Engines:** I3 · I4 · I5 · I6 · flat-4 · flat-6 · V6 (60°/90°/120°) · VR6 · V8 crossplane · V8 flatplane · V10 · V12 · W12 · W16 · EV motor (single/dual). Rotary is a stretch goal.

**Vehicles.** Audience: students learning *why* cars are packaged the way they are and what that does to handling. So the catalog is organised as **comparisons that differ in one variable**.

Each entry is a **real car**: `name` is the model ("BMW Z4 (G29)"), the id is its kebab-case slug, `archetype` groups the layout family, and `examples` lists siblings with the same layout. Engines stay layout-generic (`i6`, `v8-flat`) and list real engines as examples.

| id | layout | teaches |
|---|---|---|
| `smart-fortwo-brabus-451` ✓ | transverse I3 under the boot floor, RR | shortest possible car with the most cabin |
| `fiat-500-1957` | air-cooled twin behind the rear axle, RR | **vs the 2007 500:** same badge, opposite layout |
| `abarth-500-312` | transverse I4, FF | why almost every small car went FF |
| `vw-golf-mk8` | transverse I4, FF | the default layout of the world |
| `vw-golf-gti-mk8` ✓ | transverse I4, FF + LSD | traction limit, torque steer |
| `vw-golf-r-mk8` | transverse I4 + clutch-on-demand AWD | **vs GTI:** same body, plus a prop shaft and Haldex clutch |
| `bmw-m340i-g20` ✓ | longitudinal I6 front-mid, FR | the classic 50:50 recipe |
| `bmw-m4-competition-g82`, `bmw-m3-e30` | longitudinal I6 / I4 front-mid, FR | same recipe, more power: wider rear tyres, LSD |
| `audi-rs6-avant-gt-c8`, `audi-quattro-1980` | longitudinal V8 / I5 **ahead of** the front axle, Torsen AWD | **vs BMW:** nose-heavy (~58–60% front), why it understeers |
| `bmw-z4-g29`, `mazda-mx5-nd` | longitudinal I6 / I4 front-mid, FR | short wheelbase, driver over the rear axle |
| `toyota-ae86` | longitudinal I4, FR, live rear axle | why drifters love light FR cars |
| `mercedes-amg-c63-s-coupe-c205` | longitudinal V8 front-mid, FR | a big V8 pushed back behind the axle |
| `mercedes-amg-gt-r-c190` | front-mid V8 + rear transaxle | the transaxle moves gearbox mass rearward |
| `mercedes-maybach-s580-z223` | longitudinal V8, FR | refinement and space over agility |
| `porsche-911-992` ✓ | flat-6 behind the rear axle, RR | traction vs lift-off oversteer |
| `porsche-718-boxster-t-982` | flat-6/4 ahead of the rear axle, MR | **vs 911:** same maker, engine moved ~600 mm forward |
| `lotus-elise-sprint-220-s3` | transverse I4 behind the seats, MR | a hot-hatch powertrain moved behind you |
| `ferrari-f8-tributo` | longitudinal flat-plane V8, RWD, transaxle | the mid-engine ideal |
| `audi-r8-v10-gen2` ✓ | longitudinal V10, AWD | MR plus a front axle |
| `nissan-gtr-r35` | front engine, rear transaxle, AWD | two prop shafts |
| `subaru-wrx-sti` | longitudinal boxer, symmetrical AWD | low, symmetrical driveline |
| `mercedes-amg-g63-w465` | longitudinal V8 on a ladder frame, transfer case, 3 locking diffs, solid axles | classic SUV: tall CG, axle articulation, why it's not a sports car |
| `vw-tiguan-l-pro-mk3` | transverse I4 + clutch AWD, monocoque | **vs G-Class:** a tall hatchback, not an off-roader |
| `tesla-model3-awd` ✓, `tesla-model3-rwd` | skateboard battery, 1–2 motors | lowest CG of all, frunk |
| `bugatti-chiron` | mid W16, AWD | the extreme |

✓ = seeded in Phase 0. WP6 adds the rest, and each new vehicle must pass the same `massProps` ±3-point test against its published weight split. The types already cover `chassis` (monocoque / ladder-frame / spaceframe / carbon-tub), `suspension` (front/rear kind), `years` for classics and `awd: 'transfer-case'` for the off-roaders.

**MVP subset** (enough for the first four tours): `vw-golf-gti-mk8`, `vw-golf-r-mk8`, `bmw-m340i-g20`, `audi-rs6-avant-gt-c8`, `porsche-911-992`, `porsche-718-boxster-t-982`, `ferrari-f8-tributo`, `audi-r8-v10-gen2`, `mercedes-amg-g63-w465`, `tesla-model3-awd`, `smart-fortwo-brabus-451`, plus engines I3, I4, I6, flat-6, VR6, V8×2, V10, EV.

---

## 8. Milestones

1. **M0 Foundation** (WP0 + WP1): deployed skeleton, contracts, vertical slice, tests green.
2. **M1 Labs** (WP2–WP6 in parallel): each lab usable on its own at its `#/dev/*` and page route, plus the MVP catalog.
3. **M2 Stories** (WP7): the four headline tours, Home hero, nav.
4. **M3 Breadth and polish** (WP8 + catalog fill): all engines and vehicles, mobile, perf, QA.

## 9. Backlog (user requests, not yet scheduled)

- **Atkinson vs Otto cycle:** why Toyota/Honda hybrid "eco" engines (e.g. Toyota A25A-FXS, Honda LFA/LFB) give up power for efficiency. Show it on the engine: late intake-valve closing pushes part of the charge back, so the effective compression stroke is shorter than the expansion stroke (higher expansion ratio → more work per litre of fuel, less torque, filled in by the hybrid motor). Needs valve-event timing in `EngineSpec` (IVC angle or effective vs geometric compression ratio), a valve/piston animation and a P–V loop comparing the two cycles. The downloaded 2023 Toyota Avalon Hybrid is the natural example car.

- **Drive mode, rework:** today it can't be controlled, and the under/oversteer difference between cars doesn't come across. Idea: the visitor drives with the keyboard (W/↑ throttle, S/↓ brake, A/D or ←/→ steer), with each car's balance made visible as it happens (slip angles front vs rear, the line it wants vs the line it takes). (The gas pedal already answers to W, ↑ or Space in every view but drive.)
- **Spec contract gaps found while adding the catalog:** hybrid powertrains (V60 T8, Avalon, Granvia, Tourbillon) and rotary engines (RX-8); two motors on one axle (SU7 Ultra: one motor spec stands in for its twin rear motors); per-vehicle power/torque overrides (one engine file per tune today); part-time 4WD and a transfer-case clutch for xDrive/PTM; active or torque-vectoring rear diffs and selectable splits (GR-Four); differential type (open, Torsen, helical LSD); separate front/rear tyre diameters; a convertible body style; diesel and air-cooled engine flags; a race-car archetype with slick-tyre grip (the sim caps lateral grip at 1.3 g).
- **Models:** OBJ archives (the plain 2010 Smart; the Brabus stands in); ambient-occlusion maps used as base colour (Swift Hybrid's white tyres); texture and vertex budgets once correctness is settled (snapping before welding cut the Picanto 1.14 M → 265 k vertices losslessly).

## 10. Decisions log

- **Bodies:** our own procedural look-alike shells per real car (recognisable, not pixel-accurate); photoreal glTF is optional (WP9). Real car names and badges are fine for this non-profit teaching site.
- **Handling:** drive mode in the explorer, scripted scenarios only (no free-drive), settings in a corner hub.
- **UX:** one page; the car is the entry point; click to zoom inside → into a part; Esc/empty space backs out; hidden parts stop rendering. No separate lab pages.
- **Text:** show, don't tell — labels anchored to parts or text derived from data; tour captions ≤ ~60 words. Dark/light theme.
- **Sound:** turbo, blow-off and anti-lag effects are in scope as WP4 add-ons.
- **Toolchain:** portable Node lives in `.tools/` (git-ignored and excluded from Dropbox sync); nothing is installed system-wide. Run `source scripts/env.sh` (bash) or `. scripts/env.ps1` (PowerShell) before any npm command.
- **Bodies (update):** detailed models for every car (WP9), no procedural stand-in while loading.
- **Open:** English only, or i18n-ready strings? Defaulting to English with plain string constants.
