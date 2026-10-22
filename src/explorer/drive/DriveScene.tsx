/**
 * Rendered inside the Canvas in drive mode. Builds a lane for the visitor's car and one for the
 * car it is compared with, side by side, drives them through the scenario and plays the result
 * back on one clock: the scripted cars are simulated up front (so the timeline can be scrubbed
 * anywhere at once), the visitor's car is simulated live when they drive it. At the key moment
 * it stops by itself and publishes the freeze frame (cause next to effect). Writes vehiclePose
 * so the explorer's own car drives, rolls and pitches, feeds engineRuntime for the sound, and
 * draws the two-lane road, the steps of the manoeuvre, both cars' lines and balance, and the
 * comparison car.
 */
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { engineRuntime, vehiclePose } from '../../scene/runtime';
import { useTheme } from '../../scene/theme';
import {
  axleUse,
  betaOf,
  createState,
  DT,
  engineRpm,
  FL,
  frontLoadOf,
  G,
  RL,
  speedOf,
} from '../../sim/model';
import { SCENARIOS, type PathPoint } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { Balance } from './Balance';
import { useDriveCamera } from './camera';
import { DRIVE_COLORS } from './colors';
import { CatchMarks, GripRings, TwinPath } from './Cues';
import { EVENT_INPUT, TWIN_LEAVES } from './glyphs';
import { EngineBlocks } from './Engine';
import { Forces } from './Forces';
import {
  curvature,
  freezeFrame,
  judge,
  LEAD,
  useFreeze,
  VERDICTS,
  type FreezeFrame,
  type Judged,
} from './freeze';
import { Hands, useDriveKeys } from './input';
import { autoRate, findKey, laneKeyTime, type KeyMoment } from './key';
import { apartFade, chooseSide, laneStep, LANE_GAP, slidAt, STAGGER } from './lanes';
import { CLOCK_PRIORITY, frameDt } from './motion';
import { GHOST_SAME_LANE, GHOST_SIDE_LANE, PoseRim } from './DetailedCar';
import { balanceOf, CarLabel, RivalCar } from './LaneCar';
import { buildLineup, laneColor, laneOf, laneResult, useDriveResults } from './lineup';
import { pairLanes } from './twin';
import { testEnd } from './hands';
import { buildPicture, REPLAY_FIRST, usePathPicture } from './picture';
import { MATCHED } from './takeaway';
import { Road, roadLayout } from './Road';
import {
  capKmh,
  driveCars,
  drivePause,
  drivePlayback,
  driveTelemetry,
  pickedRival,
  shownPitch,
  resetTelemetry,
  shownSteer,
  STEER_SHOWN,
  useDrive,
} from './state';
import { poseOrigin, type Ground } from './world';

/** pause on the last frame before looping (s) */
const LOOP_HOLD = 2.5;
/** after the replay, a beat on its last frame before the picture of both lines (s) */
const PICTURE_AFTER = 0.6;
/** after a scripted run: a moment on its last frame, then the key stretch again from straight
 *  above (both paths and their planned lines in view), from a little before it (s) */
const REPLAY_AFTER = 1.2;
const REPLAY_LEAD = 0.6;
/** fade time either side of the loop cut (s) */
const FADE = 0.3;
/** at most this much live driving per frame (s of sim): a stalled tab doesn't fast-forward */
const LIVE_MAX_STEPS = 48;
const DEG = 180 / Math.PI;
const pt: Ground = { x: 0, z: 0 };
const NONE: readonly string[] = [];
const judged: Judged = { verdict: 'holding', turn: 0 };
/** verdicts where an end let go, which can still come after the scenario's stretch */
const LET_GO: readonly string[] = ['front', 'rear', 'spun', 'caught', 'back', 'catching'];
const scratch = createState();
const bend: PathPoint = { x: 0, n: 0, h: 0, k: 0 };
/** catching a slide: from this long before car A's rear lets go (s of sim) to the catch, the
 *  slow motion slowed this much more (to ⅛ of real time): the slide begins, then it is caught */
const SLIDE_LEAD = 0.25;
const SLIDE_RATE = 0.5;
/** the drivers' hands show from this long before the key moment's stretch (s of sim) */
const HANDS_LEAD = 0.3;

export function DriveScene({
  vehicle,
  picked = NONE,
}: {
  vehicle: VehicleSpec;
  /** the cars the visitor picked to compare with (vehicle ids); the last one drives against */
  picked?: readonly string[];
}) {
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const scenario = useDrive((s) => s.scenario);
  const kmh = useDrive((s) => capKmh(s.scenario, s.speed[s.scenario]));
  const compare = useDrive((s) => s.compare);
  const esc = useDrive((s) => s.esc);
  const forces = useDrive((s) => s.forces);
  const runId = useDrive((s) => s.runId);
  const mode = useDrive((s) => s.mode);
  const cameraMode = useDrive((s) => s.camera);

  const pickedId = picked.at(-1) ?? '';
  const lineup = useMemo(
    () => buildLineup(vehicle, { scenario, compare }, kmh, pickedRival(picked)),
    // picked by value (a new array each render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicle, scenario, compare, kmh, pickedId],
  );
  const build = useRef(0);
  const lanes = useMemo(() => {
    build.current++;
    return lineup.map((e) => laneOf(e, esc));
    // runId: a restart builds fresh lanes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup, esc, runId]);
  const [main, rival] = lanes;
  const plan = main.plan;
  // car B a ghost on car A's own line by default; side by side, a lane over (a lane change's
  // road already has two lanes: the second car gets a road of its own)
  const laneMode = useDrive((s) => s.lanes);
  const gap = laneMode === 'same' ? 0 : plan.lanes.length ? plan.roadWidth + 0.5 : LANE_GAP;
  const hands = useMemo(() => new Hands(), []);
  const clock = useMemo(() => ({ now: 0 }), []);
  const epoch = useMemo(() => ({ n: 0 }), []);
  const loop = useMemo(
    () => ({ hold: 0, since: 99, ended: false, gear: { gear: 1 }, mode: 'watch' as string }),
    [],
  );
  /** the replay from above at the end of a scripted run: on, and the stretch it plays */
  const replay = useMemo(() => ({ on: false, t0: 0, t1: 0 }), []);
  /** the moment the scenario turns on (slow motion, the freeze frame, the pin on the timeline) */
  const focus = useMemo(
    () => ({
      key: null as KeyMoment | null,
      events: [NaN, NaN],
      curves: [0, 0],
      /** when each car first slid (as its summary judges it), Infinity if it never did */
      slid: [Infinity, Infinity],
      /** the freeze frame at each of the key moment's stops, worked out with the run */
      frames: [] as FreezeFrame[],
      /** catching a slide: from just before car A's rear lets go to the catch, played slower
       *  still, so the slide is seen to begin (s of sim; NaN for none) */
      slow: [NaN, NaN],
    }),
    [],
  );
  /** the comparison car's lane: how far to which side of the visitor's (m, + = left) */
  const [offset, setOffset] = useState(gap);

  /** Run every lane from the start: scripted ones to the end at once, the visitor's live. */
  const start = useCallback(
    (live: boolean) => {
      epoch.n++;
      clock.now = 0;
      loop.hold = 0;
      loop.ended = false;
      replay.on = false;
      usePathPicture.setState({ pic: null, open: false, car: vehicle, kmh });
      // the visitor's own run waits for their first key (or touch)
      if (live && useDrive.getState().playing) useDrive.setState({ playing: false });
      loop.gear.gear = 1;
      loop.mode = live ? 'drive' : 'watch';
      resetTelemetry();
      lanes.forEach((l, i) => (driveCars[i].name = l.info.label ?? l.info.name));
      useFreeze.setState({ at: null });
      if (useDriveResults.getState().ended) useDriveResults.setState({ ended: false });
      hands.reset();
      for (const l of lanes) {
        l.run.manual = live && l === main ? hands : null;
        l.every = l.run.manual ? 1 : 2;
        l.reset();
        if (!l.run.manual) l.simTo(l.plan.duration + 1);
      }
      // braking into a turn beside car A without the brake: car B at car A's own speed
      pairLanes(lanes);
      // the side where the two cars stay furthest apart (unknown ahead of a visitor's own run)
      rival.offset = (live ? 1 : chooseSide(main, rival, gap)) * gap;
      // on car A's own line, car B is drawn just behind it: the two never sit on each other
      rival.behind = gap === 0 ? STAGGER * main.p.dims.length : 0;
      rival.show(0);
      setOffset(rival.offset);
      focus.key = findKey(SCENARIOS[plan.id], lanes, live);
      // when each car's line starts to say something: its event (on the skidpad, its let-go)
      focus.events = lanes.map((l) =>
        l.run.manual ? NaN : laneKeyTime(l, SCENARIOS[plan.id].key),
      );
      // the line each car was on just before the cause, to tell tighter from wider
      focus.curves = lanes.map((l, i) => {
        if (!Number.isFinite(focus.events[i])) return 0;
        l.rec.sample(Math.max(0, focus.events[i] - LEAD), scratch);
        return curvature(scratch);
      });
      focus.slid = lanes.map((l) => (l.run.manual ? Infinity : slidAt(l)));
      // each stop's freeze frame, ready before it is reached: the cars' tags say its verdicts
      // in a word from that stop on, whether or not the run stops there
      const key = focus.key;
      focus.frames =
        key && !live
          ? key.freeze.map((f, i) => freezeFrame(plan.id, lanes, key, f, key.labels[i]))
          : [];
      drivePause.t = focus.frames.map((f) => f.t);
      drivePause.verdicts = focus.frames.map((f) => f.cars.map((c) => c.verdict));
      drivePlayback.eventT = focus.events[0];
      const lg = main.letGo;
      focus.slow =
        plan.id === 'catch' && !live && lg && key
          ? [lg.t - SLIDE_LEAD, key.freeze[0] ?? lg.t + SLIDE_LEAD]
          : [NaN, NaN];
      // where the load was just before each driver's action: it is seen moving from there
      lanes.forEach((l, i) => {
        const tb = key?.before[i] ?? NaN;
        if (Number.isFinite(tb)) {
          l.rec.sample(Math.max(0, tb - LEAD), scratch);
          driveCars[i].frontBefore = frontLoadOf(scratch);
        } else driveCars[i].frontBefore = NaN;
      });
      // when each car's part of the test is over: its hands say so from then
      lanes.forEach((l, i) => {
        const c = driveCars[i];
        c.twin = l.info.rival === 'without';
        const end = l.run.manual ? { t: Infinity, spun: false } : testEnd(plan.id, l, c.twin);
        c.over = end.t;
        c.overSpun = end.spun;
      });
      drivePlayback.key = focus.key;
      drivePlayback.duration = plan.duration;
      drivePlayback.marks = main.marks.map((m) => ({
        t: NaN,
        label: m.label,
        kind: m.kind,
        holdS: m.holdS,
      }));
      const rows = lanes.map((l, i) =>
        l.run.manual
          ? {
              key: `you:${l.info.name}`,
              info: l.info,
              value: NaN,
              spun: false,
              verdict: null,
              letGo: null,
              outcome: null,
            }
          : laneResult(l, lineup[i].asBuilt),
      );
      useDriveResults.setState({ scenario: plan.id, metric: SCENARIOS[plan.id].headline, rows });
      // the picture of both lines for the end of the run, from the very outcomes the summary
      // lines are written from (so the two say the same numbers)
      const outcomes = rows.flatMap((r) => (r.outcome ? [r.outcome] : []));
      if (!live && outcomes.length === 2)
        usePathPicture.setState({
          pic: buildPicture(plan.id, lanes, focus.key, outcomes, rival.info.rival === 'without'),
        });
    },
    [lanes, main, rival, plan, gap, lineup, hands, clock, epoch, loop, focus, replay, vehicle, kmh],
  );

  useEffect(() => {
    // new cars, or a restart: the lesson waits for the end of this run
    useDriveResults.setState({ revealed: false });
    const drive = useDrive.getState().mode === 'drive';
    start(drive);
    if (!drive && !useDrive.getState().playing) useDrive.setState({ playing: true });
  }, [start]);

  // switching who drives: take the wheel from the script where the playhead is; give it back
  // by starting over
  useEffect(() => {
    if (loop.mode === mode) return;
    if (mode === 'watch' || loop.ended) {
      start(mode === 'drive');
      return;
    }
    loop.mode = 'drive';
    useFreeze.setState({ at: null });
    // the script's verdicts no longer stand for the visitor's car
    drivePause.t = [];
    drivePause.verdicts = [];
    usePathPicture.setState({ pic: null, open: false });
    main.every = 1;
    if (clock.now < main.head - 1e-3) main.redriveTo(clock.now);
    hands.from(main.run.st);
    main.run.manual = hands;
    // the visitor's car is no longer the script's: no slowing down or stopping for it
    focus.key = findKey(SCENARIOS[plan.id], lanes, true);
    drivePlayback.key = focus.key;
    for (let i = 0; i < drivePlayback.marks.length; i++)
      drivePlayback.marks[i].t = main.markT[i] <= clock.now ? main.markT[i] : NaN;
    const rows = useDriveResults.getState().rows;
    if (rows)
      useDriveResults.setState({
        rows: rows.map((r, i) =>
          i === 0 ? { ...r, value: NaN, verdict: null, letGo: null, outcome: null } : r,
        ),
      });
  }, [mode, main, plan, hands, clock, loop, start, focus, lanes]);

  useDriveKeys(
    useCallback(() => {
      const s = useDrive.getState();
      if (s.mode !== 'drive' || !s.playing) useDrive.setState({ mode: 'drive', playing: true });
    }, []),
    useCallback(() => useDrive.getState().restart(), []),
  );

  useEffect(() => {
    vehiclePose.active = true;
    driveTelemetry.live = true;
    // dev only: the live run, for checking it from the browser console (window.__drive)
    if (import.meta.env.DEV)
      Object.assign(window, {
        __drive: {
          telemetry: driveTelemetry,
          cars: driveCars,
          playback: drivePlayback,
          pause: drivePause,
          settings: useDrive,
          freeze: useFreeze,
          picture: usePathPicture,
        },
      });
    const saved = { rpm: engineRuntime.rpm, throttle: engineRuntime.throttle };
    return () => {
      Object.assign(vehiclePose, {
        active: false,
        x: 0,
        z: 0,
        yaw: 0,
        roll: 0,
        pitch: 0,
        wheelSpin: 0,
        steer: 0,
      });
      engineRuntime.rpm = saved.rpm;
      engineRuntime.throttle = saved.throttle;
      driveTelemetry.live = false;
      useFreeze.setState({ at: null });
      usePathPicture.setState({ pic: null, open: false });
    };
  }, []);

  // first in the frame: the cars' poses, then the camera aims at them, then they are drawn
  // (motion.ts); the clock steps by the display's frame interval
  useFrame((_, delta) => {
    const dt = Math.min(frameDt(delta), 0.1);
    const { playing, rate, autoSlow, autoPause, mode: who } = useDrive.getState();
    const live = who === 'drive' && !!main.run.manual;
    // slow motion by itself round the key moment, unless the visitor picked a rate or drives
    const auto = autoSlow && !live;
    const sliding = clock.now >= focus.slow[0] && clock.now <= focus.slow[1];
    const pace = auto ? autoRate(focus.key, clock.now) * (sliding ? SLIDE_RATE : 1) : rate;
    const dur = plan.duration;
    const pb = drivePlayback;
    const stretch = SCENARIOS[plan.id].key.after;
    const fz = focus.key?.freeze;
    const lastFreeze = fz && fz.length ? fz[fz.length - 1] : 0;

    if (pb.seek !== null) {
      clock.now = Math.max(0, Math.min(live ? main.head : dur, pb.seek));
      pb.seek = null;
      loop.ended = false;
      loop.hold = 0;
      replay.on = false;
      if (useDriveResults.getState().ended) useDriveResults.setState({ ended: false });
      if (useFreeze.getState().at) useFreeze.setState({ at: null });
      if (usePathPicture.getState().open) usePathPicture.setState({ open: false });
    }
    const was = clock.now;
    // a scripted run with a key moment replays it from above, or (and) ends on the picture of
    // both lines, which stays until the visitor moves on
    const canReplay = !live && !!focus.key;
    const picture = usePathPicture.getState();
    // every question ends on its picture (the visitor's own run too, once it has one)
    const pictured = !!picture.pic;
    const replayFirst = canReplay && (!pictured || REPLAY_FIRST.includes(plan.id));
    const showPicture = () => {
      usePathPicture.setState({ open: true });
      useDrive.setState({ playing: false });
      loop.hold = 0;
    };
    if (playing && picture.open) {
      // played again from the picture: the run from the top
      usePathPicture.setState({ open: false });
      start(live);
      driveTelemetry.loops++;
      loop.since = 0;
    } else if (playing) {
      if (replay.on) {
        if (clock.now < replay.t1) clock.now = Math.min(replay.t1, clock.now + dt * pace);
        else {
          loop.hold += dt;
          if (pictured && loop.hold > PICTURE_AFTER) showPicture();
          else if (!pictured && loop.hold > LOOP_HOLD) {
            start(live);
            driveTelemetry.loops++;
            loop.since = 0;
          }
        }
      } else if (!loop.ended) {
        // the visitor's hands only count at the live edge, within a step of the sim (behind it
        // is a replay)
        if (live && clock.now > main.head - DT - 1e-6) hands.update(dt, main.p, main.run.st);
        clock.now = Math.min(dur, clock.now + dt * pace);
      } else {
        loop.hold += dt;
        if (!replayFirst && pictured && loop.hold > REPLAY_AFTER) showPicture();
        else if (replayFirst && loop.hold > REPLAY_AFTER) {
          const k = focus.key!;
          replay.on = true;
          replay.t0 = Math.max(0, k.t0 - REPLAY_LEAD);
          replay.t1 = Math.min(dur, k.end);
          clock.now = replay.t0;
          loop.hold = 0;
          loop.since = 0;
        } else if (!replayFirst && !pictured && loop.hold > LOOP_HOLD) {
          start(live);
          driveTelemetry.loops++;
          loop.since = 0;
        }
      }
    }
    // the key moment: stop there and show cause next to effect (not while the visitor drives)
    const key = focus.key;
    if (playing && autoPause && !live && key && !replay.on) {
      for (let i = 0; i < key.freeze.length; i++) {
        const f = key.freeze[i];
        if (was >= f || clock.now < f) continue;
        clock.now = f;
        useDrive.setState({ playing: false });
        for (const l of lanes) l.show(f);
        useFreeze.setState({
          at: focus.frames[i] ?? freezeFrame(plan.id, lanes, key, f, key.labels[i]),
        });
        break;
      }
    }
    if (live) {
      main.simTo(clock.now, LIVE_MAX_STEPS);
      // a slow frame: the live car can't jump ahead, so neither does the clock
      clock.now = Math.min(clock.now, main.run.st.t);
    }
    if (playing && !loop.ended && clock.now >= dur - 1e-6) {
      loop.ended = true;
      loop.hold = 0;
      useDriveResults.setState({ revealed: true, ended: true });
      if (live) {
        // the visitor's own run, judged like the scripted ones, and pictured the same way
        const row = laneResult(main);
        const rows = useDriveResults.getState().rows;
        if (rows) {
          const next = rows.map((r, i) => (i === 0 ? row : r));
          useDriveResults.setState({ rows: next });
          const outcomes = next.flatMap((r) => (r.outcome ? [r.outcome] : []));
          if (outcomes.length === 2)
            usePathPicture.setState({
              pic: buildPicture(
                plan.id,
                lanes,
                focus.key,
                outcomes,
                rival.info.rival === 'without',
              ),
            });
        }
      }
    }
    for (let i = 0; i < lanes.length; i++) {
      const l = lanes[i];
      l.show(clock.now);
      const c = driveCars[i];
      // the visitor's own car: from its event on, once they get there
      const tE = live && i === 0 ? l.run.ctl.tEvent : focus.events[i];
      if (clock.now >= tE) {
        // the line is judged over the scenario's stretch, then kept: once the driver takes the
        // wheel back, or the road straightens, it says nothing more about the cause
        // (kept from the freeze frame, where there is one, so the two always agree)
        const tw = Math.min(clock.now, lastFreeze || tE + stretch);
        l.rec.sample(tw, scratch);
        judge(plan.id, l, scratch, tw, focus.curves[i], judged);
        if (tw < clock.now && !LET_GO.includes(judged.verdict) && (l.view.spun || l.letGo))
          judge(plan.id, l, l.view, clock.now, focus.curves[i], judged);
        c.status = 1 + VERDICTS.indexOf(judged.verdict);
        c.turn = judged.turn;
      } else c.status = 0;
      c.step = laneStep(l, clock.now);
      c.kmh = speedOf(l.view) * 3.6;
      c.front = frontLoadOf(l.view);
      c.useF = axleUse(l.view, FL);
      c.useR = axleUse(l.view, RL);
      // the driver's hands and feet, and which way the road turns there (opposite lock)
      c.steerDeg = l.view.steer * DEG;
      c.throttle = l.view.throttle;
      c.brake = l.view.brake;
      const k = l.plan.path.at(l.rec.sAtTime(clock.now), bend).k;
      c.turnSign = Math.abs(k) < 1e-4 ? 0 : Math.sign(k);
      c.phase = live && i === 0 ? -1 : l.phase;
      // a car that slid, as its summary judges it: only then is steering out of the turn
      // opposite lock (the visitor's own car: once its rear has let go)
      c.slid =
        l.view.spun ||
        (live && i === 0 ? l.letGoBy(clock.now)?.axle === 'rear' : clock.now >= focus.slid[i]);
    }
    // car B on car A's own line, caught up with car A: faded out rather than drawn over it
    rival.fadeTo(useDrive.getState().lanes === 'same' ? apartFade(main, rival) : 1, dt);

    // ease the view out just before each cut (to the replay, and back to the start) and back in
    // just after
    loop.since += dt;
    // (none before the picture: it opens over the last frame)
    const cutAt = replay.on
      ? clock.now >= replay.t1 && !pictured
        ? LOOP_HOLD
        : Infinity
      : replayFirst
        ? REPLAY_AFTER
        : pictured
          ? Infinity
          : LOOP_HOLD;
    const out =
      loop.ended && Number.isFinite(cutAt)
        ? Math.min(1, Math.max(0, (loop.hold - (cutAt - FADE)) / FADE))
        : 0;
    driveTelemetry.fade = Math.max(out, Math.max(0, 1 - loop.since / FADE));

    const st = main.view;
    poseOrigin(main.p, st, pt);
    vehiclePose.x = pt.x;
    vehiclePose.z = pt.z;
    vehiclePose.yaw = st.yaw;
    vehiclePose.roll = st.roll;
    // the body's pitch, drawn deeper so the load moving shows (state.ts shownPitch)
    vehiclePose.pitch = shownPitch(st.pitch);
    vehiclePose.wheelSpin = st.wheelSpin;
    // the wheels point at the driver's angle less what compliance winds back
    vehiclePose.steer = shownSteer(st.steer - st.twist, plan.id === 'catch' ? STEER_SHOWN : 1);
    const v = speedOf(st);
    const rpm = engineRpm(main.p, v, st.throttle, loop.gear);
    engineRuntime.rpm = rpm;
    engineRuntime.throttle = playing ? st.throttle : 0;

    const tel = driveTelemetry;
    tel.speedKmh = v * 3.6;
    tel.latG = st.ay / G;
    tel.yawDeg = st.r * DEG;
    tel.slipDeg = betaOf(st) * DEG;
    tel.alphaF = Math.abs(st.alphaF) * DEG;
    tel.alphaR = Math.abs(st.alphaR) * DEG;
    tel.useF = axleUse(st, FL);
    tel.useR = axleUse(st, RL);
    tel.front = frontLoadOf(st);
    tel.balance = balanceOf(main);
    tel.throttle = st.throttle;
    tel.brake = st.brake;
    tel.steerDeg = (st.steer - st.twist) * DEG;
    tel.handsStill =
      !live && main.phase === 1 && main.marks.some((m) => m.kind === 'event' && !!m.holdS);
    tel.gear = main.p.drive.kind === 'ev' ? 'D' : String(loop.gear.gear);
    tel.rpm = rpm;
    tel.phase = main.phase;
    tel.spun = st.spun;
    pb.t = clock.now;
    pb.duration = dur;
    pb.slow = auto && playing && !loop.ended && pace < 0.98;
    pb.keyOn = !!focus.key && clock.now >= focus.key.t0 - HANDS_LEAD && clock.now <= focus.key.end;
    pb.replaying = replay.on;
    pb.head = live ? main.head : dur;
    for (let i = 0; i < pb.marks.length; i++) {
      const tm = main.markT[i];
      pb.marks[i].t = tm <= clock.now || !live ? tm : NaN;
    }
  }, CLOCK_PRIORITY);

  const pair = useMemo(() => ({ rival, focus, t: clock, replay }), [rival, focus, clock, replay]);
  useDriveCamera(main, plan, cameraMode, epoch, offset, pair);

  const layout = useMemo(() => roadLayout(plan, offset), [plan, offset]);
  // tarmac behind the start for car B, drawn behind car A on its line, and for both cars' tails
  const runIn = (gap === 0 ? STAGGER : 0) * main.p.dims.length + main.p.dims.length;
  const k = build.current;
  const you = laneColor(main.info, colors);
  const them = laneColor(rival.info, colors);
  const lineColors = useMemo(() => [you, them], [you, them]);
  // braking into a turn beside the same car at its speed: the two speeds, on the cars
  // braking into a turn beside the same car at its speed: car B is only its path (dotted)
  const pathOnly = MATCHED.includes(plan.id) && rival.info.rival === 'without';
  // car B is car A itself, changed (without the action, or its rear grip changed)
  const same = rival.info.rival !== 'contrast' && rival.info.rival !== 'car';
  // what each car's driver does at its moment, popped over it (the twin without it does none)
  const acts = plan.id === 'catch' ? 'wheel' : (EVENT_INPUT[plan.id] ?? null);
  return (
    <>
      {/* the road; a lane over, each car's planned line in its colour */}
      <Road
        plan={plan}
        colors={colors}
        layout={layout}
        lineColors={offset ? lineColors : undefined}
        planned={!!offset}
        runIn={runIn}
      />
      {/* round every tyre, a ring: green, amber near the limit, red once that end has let go */}
      {lanes.map((l, i) =>
        i === 1 && pathOnly ? null : (
          <GripRings key={`g${k}-${i}`} lane={l} t={clock} colors={colors} />
        ),
      )}
      {/* braking into a turn: where the same car at the same speed goes without the brake */}
      {pathOnly && <TwinPath key={`tp${k}`} lane={rival} t={clock} color={them} />}
      {/* catching a slide: where the front wheels point against where the front goes */}
      {plan.id === 'catch' &&
        lanes.map((l, i) => <CatchMarks key={`cm${k}-${i}`} lane={l} colors={colors} />)}
      {/* the visitor at the wheel: where their steering asks to go against where the car goes */}
      {mode === 'drive' && (
        <Balance
          key={`b${k}`}
          lane={main}
          colors={colors}
          intent
          rays
          size={2.6}
          sideways={false}
        />
      )}
      {forces && <Forces run={main} colors={colors} />}
      {/* where each car's mass sits, seen through its body: its engine (or motors and battery) */}
      <EngineBlocks key={`e${k}-0`} lane={main} vehicle={vehicle} />
      {rival.info.vehicle && !pathOnly && (
        <EngineBlocks key={`e${k}-1`} lane={rival} vehicle={rival.info.vehicle} />
      )}
      {rival.info.vehicle && !pathOnly && (
        <RivalCar
          key={`c${k}`}
          lane={rival}
          vehicle={rival.info.vehicle}
          color={them}
          ghost={laneMode === 'same' ? GHOST_SAME_LANE : GHOST_SIDE_LANE}
          steerScale={plan.id === 'catch' ? STEER_SHOWN : 1}
        />
      )}
      {/* a rim round each car in its colour */}
      <PoseRim vehicle={vehicle} color={you} />
      {/* one tag per car (its name, its driver's action popped as it happens, from the key
          moment its outcome in a word), beside it on screen, clear of the other car and the HUD */}
      <CarLabel
        key={`l${k}-0`}
        lane={main}
        other={pathOnly ? undefined : rival}
        slot={0}
        t={clock}
        name={mode === 'drive' ? 'You' : main.info.label}
        color={you}
        id={plan.id}
        colors={colors}
        acts={mode === 'drive' ? null : acts}
      />
      {!pathOnly && (
        <CarLabel
          key={`l${k}-1`}
          lane={rival}
          other={main}
          slot={1}
          t={clock}
          name={rival.info.label}
          color={them}
          id={plan.id}
          colors={colors}
          acts={same ? null : acts}
          twin={same}
          leaves={rival.info.rival === 'without' ? (TWIN_LEAVES[plan.id] ?? null) : null}
        />
      )}
    </>
  );
}
