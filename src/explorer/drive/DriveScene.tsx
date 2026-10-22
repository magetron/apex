/**
 * Rendered inside the Canvas in drive mode. Builds a lane per car (the visitor's car plus the
 * comparison cars), drives them through the scenario and plays the result back on one clock:
 * the scripted cars are simulated up front (so the timeline can be scrubbed anywhere at once),
 * the visitor's car is simulated live when they drive it. Writes vehiclePose so the explorer's
 * own car drives, rolls and pitches, feeds engineRuntime for the sound, and draws the road, the
 * steps of the manoeuvre, every car's line and balance, and the comparison cars.
 */
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { engineRuntime, vehiclePose } from '../../scene/runtime';
import { useTheme } from '../../scene/theme';
import { axleUse, betaOf, engineRpm, FL, frontLoadOf, G, RL, speedOf } from '../../sim/model';
import { SCENARIOS } from '../../sim/scenarios';
import type { VehicleSpec } from '../../spec/types';
import { useDriveCamera } from './camera';
import { DRIVE_COLORS } from './colors';
import { Forces } from './Forces';
import { Hands, useDriveKeys } from './input';
import { Lane } from './lanes';
import { balanceOf, LaneCar, LetGoPin } from './LaneCar';
import { buildLineup, laneColor, useDriveResults, type ResultRow } from './lineup';
import { Marks } from './Marks';
import { Road } from './Road';
import { drivePlayback, driveTelemetry, resetTelemetry, useDrive } from './state';
import { Balance } from './Balance';
import { PathLine, TyreMarks } from './Tracks';
import { poseOrigin, type Ground } from './world';

/** pause on the last frame before looping (s) */
const LOOP_HOLD = 2.5;
/** fade time either side of the loop cut (s) */
const FADE = 0.3;
/** at most this much live driving per frame (s of sim): a stalled tab doesn't fast-forward */
const LIVE_MAX_STEPS = 48;
const DEG = 180 / Math.PI;
const pt: Ground = { x: 0, z: 0 };

/** Each lane's result for the info card, from what it drove. */
function resultOf(lane: Lane, label?: string): ResultRow {
  const def = SCENARIOS[lane.plan.id];
  const res = lane.plan.summarize(lane.rec.toTrace(2), lane.p);
  res.spun = res.spun || lane.run.st.spun;
  return {
    key: `${lane.info.kind}:${lane.info.code}:${lane.info.name}`,
    info: lane.info,
    label,
    value: res.values[res.headline] ?? NaN,
    spun: res.spun,
    verdict: def.verdict?.(res) ?? null,
    letGo: lane.letGo ? { axle: lane.letGo.axle, g: lane.letGo.g } : null,
  };
}

export function DriveScene({ vehicle }: { vehicle: VehicleSpec }) {
  const theme = useTheme((s) => s.theme);
  const colors = DRIVE_COLORS[theme];
  const scenario = useDrive((s) => s.scenario);
  const kmh = useDrive((s) => s.speed[s.scenario]);
  const ghosts = useDrive((s) => s.ghosts);
  const compare = useDrive((s) => s.compare);
  const esc = useDrive((s) => s.esc);
  const forces = useDrive((s) => s.forces);
  const runId = useDrive((s) => s.runId);
  const mode = useDrive((s) => s.mode);
  const cameraMode = useDrive((s) => s.camera);

  const lineup = useMemo(
    () => buildLineup(vehicle, { scenario, ghosts, compare }, kmh),
    [vehicle, scenario, ghosts, compare, kmh],
  );
  const build = useRef(0);
  const lanes = useMemo(() => {
    build.current++;
    return lineup.map((e) => new Lane(e.params, e.plan, esc, e.info));
    // runId: a restart builds fresh lanes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup, esc, runId]);
  const main = lanes[0];
  const hands = useMemo(() => new Hands(), []);
  const clock = useMemo(() => ({ now: 0 }), []);
  const epoch = useMemo(() => ({ n: 0 }), []);
  const loop = useMemo(
    () => ({ hold: 0, since: 99, ended: false, gear: { gear: 1 }, mode: 'watch' as string }),
    [],
  );

  /** Run every lane from the start: scripted ones to the end at once, the visitor's live. */
  const start = useCallback(
    (live: boolean) => {
      epoch.n++;
      clock.now = 0;
      loop.hold = 0;
      loop.ended = false;
      loop.gear.gear = 1;
      loop.mode = live ? 'drive' : 'watch';
      resetTelemetry();
      hands.reset();
      for (const l of lanes) {
        l.run.manual = live && l === main ? hands : null;
        l.reset();
        if (!l.run.manual) l.simTo(l.plan.duration + 1);
      }
      drivePlayback.duration = main.plan.duration;
      drivePlayback.marks = main.marks.map((m) => ({
        t: NaN,
        label: m.label,
        kind: m.kind,
        holdS: m.holdS,
      }));
      useDriveResults.setState({
        metric: SCENARIOS[main.plan.id].headline,
        rows: lanes.map((l, i) =>
          l.run.manual
            ? {
                key: `you:${l.info.name}`,
                info: l.info,
                value: NaN,
                spun: false,
                verdict: null,
                letGo: null,
              }
            : resultOf(l, lineup[i].label),
        ),
      });
    },
    [lanes, main, lineup, hands, clock, epoch, loop],
  );

  useEffect(() => {
    start(useDrive.getState().mode === 'drive');
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
    if (clock.now < main.head - 1e-3) main.redriveTo(clock.now);
    hands.from(main.run.st);
    main.run.manual = hands;
    for (let i = 0; i < drivePlayback.marks.length; i++)
      drivePlayback.marks[i].t = main.markT[i] <= clock.now ? main.markT[i] : NaN;
    const rows = useDriveResults.getState().rows;
    if (rows)
      useDriveResults.setState({
        rows: rows.map((r, i) => (i === 0 ? { ...r, value: NaN, verdict: null, letGo: null } : r)),
      });
  }, [mode, main, hands, clock, loop, start]);

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
    };
  }, []);

  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const { playing, rate, mode: who } = useDrive.getState();
    const live = who === 'drive' && !!main.run.manual;
    const dur = main.plan.duration;
    const pb = drivePlayback;

    if (pb.seek !== null) {
      clock.now = Math.max(0, Math.min(live ? main.head : dur, pb.seek));
      pb.seek = null;
      loop.ended = false;
      loop.hold = 0;
    }
    if (playing) {
      if (!loop.ended) {
        // the visitor's hands only count at the live edge (behind it is a replay)
        if (live && clock.now >= main.head - 1e-6) hands.update(dt, main.p, main.run.st);
        clock.now = Math.min(dur, clock.now + dt * rate);
      } else {
        loop.hold += dt;
        if (loop.hold > LOOP_HOLD) {
          start(live);
          driveTelemetry.loops++;
          loop.since = 0;
        }
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
      if (live) {
        // the visitor's own run, judged like the scripted ones
        const row = resultOf(main);
        const rows = useDriveResults.getState().rows;
        if (rows) useDriveResults.setState({ rows: rows.map((r, i) => (i === 0 ? row : r)) });
      }
    }
    for (const l of lanes) l.show(clock.now);

    // ease the view out just before the loop cut and back in just after
    loop.since += dt;
    driveTelemetry.fade = loop.ended
      ? Math.min(1, Math.max(0, (loop.hold - (LOOP_HOLD - FADE)) / FADE))
      : Math.max(0, 1 - loop.since / FADE);

    const st = main.view;
    poseOrigin(main.p, st, pt);
    vehiclePose.x = pt.x;
    vehiclePose.z = pt.z;
    vehiclePose.yaw = st.yaw;
    vehiclePose.roll = st.roll;
    vehiclePose.pitch = st.pitch;
    vehiclePose.wheelSpin = st.wheelSpin;
    // the wheels point at the driver's angle less what compliance winds back
    vehiclePose.steer = st.steer - st.twist;
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
    pb.head = live ? main.head : dur;
    for (let i = 0; i < pb.marks.length; i++) {
      const tm = main.markT[i];
      pb.marks[i].t = tm <= clock.now || !live ? tm : NaN;
    }
  }, -3);

  useDriveCamera(main, main.plan, cameraMode, epoch);

  const k = build.current;
  return (
    <>
      <Road plan={main.plan} colors={colors} />
      <Marks key={`m${k}`} lane={main} t={clock} colors={colors} />
      <TyreMarks key={`t${k}`} lane={main} t={clock} colors={colors} />
      {lanes.map((l, i) => (
        <PathLine
          key={`p${k}-${i}`}
          lane={l}
          t={clock}
          color={laneColor(l.info, colors, theme)}
          width={i === 0 ? 0.22 : 0.16}
        />
      ))}
      {lanes.map((l, i) => (
        <Balance
          key={`b${k}-${i}`}
          lane={l}
          colors={colors}
          intent={i === 0}
          rays={i === 0}
          size={i === 0 ? 2.6 : 1.8}
        />
      ))}
      {forces && <Forces run={main} colors={colors} />}
      {lanes.slice(1).map((l, i) => (
        <LaneCar
          key={`c${k}-${i}`}
          lane={l}
          color={laneColor(l.info, colors, theme)}
          label={lineup[i + 1]?.label}
        />
      ))}
      {lanes.map((l, i) => (
        <LetGoPin
          key={`g${k}-${i}`}
          lane={l}
          t={clock}
          full={l.info.kind !== 'ghost'}
          color={laneColor(l.info, colors, theme)}
        />
      ))}
    </>
  );
}
