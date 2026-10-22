/**
 * Rendered inside the Canvas at #/<car>/track/<circuit>: the circuit, and every car's hot lap
 * played back on one clock. The laps are worked out off the main thread (laps.ts) and animated
 * directly along the racing line: position and heading from the line, roll and pitch from the
 * lap's accelerations, the wheels from the distance covered. Car A is the explorer's own car
 * (posed through vehiclePose, its engine sound fed from the lap); the cars it is compared with
 * are ghosts.
 *
 * The clock waits until every car's model is in and its shaders are compiled (otherwise the
 * first seconds crawl), runs until the last car is home, then holds on the result. It steps by
 * the display's frame interval, and every pose is worked out before the camera aims at car A and
 * before anything is drawn (drive/motion.ts): the car, the camera and the tags show one moment.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { engineRuntime, vehiclePose } from '../../scene/runtime';
import { carParams } from '../../sim/model';
import { getTrack, keyMoments, trackPath, type RaceLine } from '../../sim/track';
import { getVehicle } from '../../spec/catalog';
import { useModelLoad } from '../../vehicle3d/gltf/load';
import { gltfUrl } from '../../vehicle3d/gltf/manifest';
import type { View } from '../view';
import { CLOCK_PRIORITY, frameDt } from '../drive/motion';
import { useTrackCamera } from './camera';
import { LimitBands, MomentLabels } from './Marks3D';
import { distanceAt, newPose, poseAt } from './pose';
import { Racers } from './Racers';
import { Ribbon } from './Ribbon';
import {
  FINISH_BEAT,
  playback,
  racerSpots,
  tagView,
  useHotLap,
  useRacers,
  type Racer,
} from './state';

/** at most this much playback per frame (s): a stalled tab doesn't jump ahead */
const MAX_STEP = 0.25;

/** Every car's model in (or failed), so the clock may start. */
function useModelsIn(racers: Racer[]) {
  const urls = useMemo(
    () => racers.map((r) => gltfUrl(r.vehicle.id)).filter((u): u is string => !!u),
    [racers],
  );
  return useModelLoad((s) =>
    urls.every((u) => s[u]?.state === 'ready' || s[u]?.state === 'failed'),
  );
}

function Running({
  view,
  trackId,
  racers,
  line,
}: {
  view: View;
  trackId: string;
  racers: Racer[];
  line: RaceLine;
}) {
  const a = racers[0].vehicle;
  const spec = getTrack(trackId);
  const path = trackPath(trackId);
  const p = useMemo(() => carParams(a), [a]);
  const pose = useMemo(newPose, []);
  const other = useMemo(newPose, []);
  const camera = useHotLap((s) => s.camera);
  const restart = useHotLap((s) => s.restart);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const cam = useThree((s) => s.camera);
  useTrackCamera(path, spec.mapHeadingDeg, camera, pose);
  const moments = useMemo(
    () =>
      keyMoments(
        racers.map((r) => r.lap),
        path,
      ),
    [racers, path],
  );

  const vsKey = view.vs?.join(',') ?? '';
  useEffect(() => {
    playback.t = 0;
    playback.end = Math.max(...racers.map((r) => r.lap.time));
    useHotLap.setState({ finished: false, playing: true });
    // a new circuit or new cars: from the line again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId, vsKey, a.id, restart]);
  useEffect(() => {
    playback.end = Math.max(...racers.map((r) => r.lap.time));
  }, [racers]);

  // the clock starts once every model is in and its shaders are compiled
  const modelsIn = useModelsIn(racers);
  useEffect(() => {
    useHotLap.setState({ ready: false });
    if (!modelsIn) return;
    let live = true;
    let raf = 0;
    const go = () => {
      if (live) useHotLap.setState({ ready: true });
    };
    // two frames so the cars just mounted are in the scene, then compile what they draw with
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const compile = (gl as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown> })
          .compileAsync;
        if (compile) compile.call(gl, scene, cam).then(go, go);
        else go();
      });
    });
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [modelsIn, racers, gl, scene, cam]);

  useEffect(() => {
    vehiclePose.active = true;
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
      tagView.ok = false;
      racerSpots.length = 0;
      useHotLap.setState({ ready: false });
    };
  }, []);

  useFrame((_, delta) => {
    const st = useHotLap.getState();
    if (st.ready && st.playing && !document.hidden) {
      playback.t += Math.min(frameDt(delta), MAX_STEP) * st.speed;
      if (playback.t >= playback.end + FINISH_BEAT) {
        playback.t = playback.end + FINISH_BEAT;
        useHotLap.setState({ playing: false, finished: true });
      }
    }
    // where everyone is, for the tags
    racerSpots.length = racers.length;
    for (let k = 0; k < racers.length; k++) {
      const q = k ? other : pose;
      poseAt(line, racers[k].lap, playback.t, q);
      racerSpots[k] = racerSpots[k] ?? { x: 0, z: 0, on: true };
      racerSpots[k].x = q.x;
      racerSpots[k].z = q.z;
      racerSpots[k].on = true;
    }
    // car A (its pose is the first worked out above): the explorer's own car
    playback.at = pose.at;
    vehiclePose.x = pose.x;
    vehiclePose.z = pose.z;
    vehiclePose.yaw = pose.yaw;
    vehiclePose.roll = p.rollGain * pose.ay;
    vehiclePose.pitch = p.pitchGain * pose.ax;
    vehiclePose.steer = p.L * pose.k;
    vehiclePose.wheelSpin = (distanceAt(line, pose.at) / p.wheelRadius) % (2 * Math.PI);
    engineRuntime.rpm = Math.max(p.drive.idleRpm, pose.rpm);
    engineRuntime.throttle = st.playing ? pose.throttle : 0;
  }, CLOCK_PRIORITY);
  // the camera as it is drawn this frame (camera-controls has moved it by now, and only brings
  // its matrices up to date itself with a focal offset), for the HUD's name tags
  useFrame(({ camera: c }) => {
    c.updateMatrixWorld();
    tagView.m.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
    tagView.ok = true;
  });

  return (
    <>
      <Ribbon path={path} line={line} />
      <LimitBands racers={racers} line={line} path={path} />
      <MomentLabels moments={moments} racers={racers} path={path} />
      <Racers racers={racers} line={line} />
    </>
  );
}

function Lapping({ view, trackId }: { view: View; trackId: string }) {
  const racers = useRacers(trackId, getVehicle(view.vehicleId), view.vs);
  // the laps are still being driven (off the main thread): nothing to show yet
  if (!racers.length || !racers.line) return null;
  return <Running view={view} trackId={trackId} racers={racers} line={racers.line} />;
}

export function TrackScene({ view }: { view: View }) {
  if (view.level !== 'track' || !view.track) return null;
  return <Lapping view={view} trackId={view.track} />;
}
