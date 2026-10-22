/**
 * Engine (or motor) speed from road speed, for the sound synth to follow in drive mode: a
 * generic automatic for combustion engines, the single reduction for EVs. Visual/audio only:
 * the handling model works in wheel forces and doesn't need gears.
 */
import type { CarParams } from './params';

/** Ratio step between gears (top gear ≈ first / step^(gears−1)). */
const STEP = 1.32;

export interface GearState {
  gear: number;
}

export function engineRpm(p: CarParams, speed: number, throttle: number, gs: GearState): number {
  const d = p.drive;
  const wheelRpm = (Math.max(0, speed) / p.wheelRadius) * (60 / (2 * Math.PI));
  if (d.kind === 'ev') return wheelRpm * d.lowRatio;
  const rpmIn = (g: number) => wheelRpm * d.lowRatio * STEP ** -(g - 1);
  // shift later the harder you push, like a real automatic
  const up = d.redlineRpm * (0.55 + 0.37 * throttle);
  const down = d.redlineRpm * 0.3;
  gs.gear = Math.min(d.gears, Math.max(1, gs.gear));
  while (gs.gear < d.gears && rpmIn(gs.gear) > up) gs.gear++;
  while (gs.gear > 1 && rpmIn(gs.gear) < down) gs.gear--;
  return Math.max(d.idleRpm, Math.min(d.redlineRpm, rpmIn(gs.gear)));
}
