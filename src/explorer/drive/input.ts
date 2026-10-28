/**
 * The visitor's hands in drive mode: keys (W/↑/Space gas, as the gas pedal everywhere else on
 * the site; S/↓ brake; A/D or ←/→ steer) and the on-screen pedals and wheel, turned into ramped,
 * analogue-ish inputs. Ramps run on the wall clock, so slow motion gives quicker hands.
 */
import { useEffect } from 'react';
import type { CarParams, CarState } from '../../sim/model';
import { G } from '../../sim/model';
import { useDrive } from './state';

/** What is held right now (keys and touch both write here). */
export const held = {
  gas: false,
  brake: false,
  left: false,
  right: false,
  /** on-screen controls: 0..1 pedals, −1..1 wheel (+ = left); used while non-zero */
  touchGas: 0,
  touchBrake: 0,
  touchSteer: 0,
};

const KEYS: Record<string, keyof Pick<typeof held, 'gas' | 'brake' | 'left' | 'right'>> = {
  KeyW: 'gas',
  ArrowUp: 'gas',
  Space: 'gas',
  KeyS: 'brake',
  ArrowDown: 'brake',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function releaseAll() {
  held.gas = held.brake = held.left = held.right = false;
  held.touchGas = held.touchBrake = held.touchSteer = 0;
}

const field = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

/**
 * Listen for the drive keys while mounted. `onDrive` fires on the first press of a drive key
 * (the scene hands the car over to the visitor); R restarts.
 */
export function useDriveKeys(onDrive: () => void, onRestart: () => void) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (field(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyR' && !e.repeat) {
        onRestart();
        return;
      }
      // watching the test driver, Space pauses and resumes: it never takes the wheel (W or the
      // up arrow does)
      if (e.code === 'Space' && useDrive.getState().mode === 'watch') {
        e.preventDefault();
        if (!e.repeat) useDrive.setState({ playing: !useDrive.getState().playing });
        return;
      }
      const k = KEYS[e.code];
      if (!k) return;
      // no page scroll, and a focused button would otherwise click on Space
      e.preventDefault();
      if (!held[k] && !e.repeat) onDrive();
      held[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      const k = KEYS[e.code];
      if (k) held[k] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [onDrive, onRestart]);
}

/** pedal travel per second, pressing and releasing */
const GAS_ON = 2.2;
const GAS_OFF = 4;
const BRAKE_ON = 2.5;
const BRAKE_OFF = 5;
/** road-wheel steering rate (rad/s) while a key is held, and when let go */
const STEER_RATE = 0.9;
const RETURN_RATE = 1.6;
/** lock beyond the front tyres' peak slip a key can ask for (rad): enough to overdrive them */
const OVERDRIVE = 0.12;

/** Ramped inputs for the sim, in its units (rad, 0..1). */
export class Hands {
  steer = 0;
  throttle = 0;
  brake = 0;

  /** Start from what the car is doing (a take-over mid-run doesn't jerk the wheel). */
  from(st: CarState) {
    this.steer = st.steer;
    this.throttle = st.throttle;
    this.brake = st.brake;
  }

  reset() {
    this.steer = this.throttle = this.brake = 0;
  }

  update(dt: number, p: CarParams, st: CarState) {
    const v = Math.max(1, Math.hypot(st.vx, st.vy));
    const gas = held.touchGas > 0 ? held.touchGas : held.gas ? 1 : 0;
    const brake = held.touchBrake > 0 ? held.touchBrake : held.brake ? 1 : 0;
    this.throttle = ramp(this.throttle, gas, GAS_ON * dt, GAS_OFF * dt);
    this.brake = ramp(this.brake, brake, BRAKE_ON * dt, BRAKE_OFF * dt);

    // where the front axle is actually travelling, relative to the car (rad)
    const theta = v > 2 ? Math.atan2(st.vy + p.a * st.r, st.vx) + st.twist : 0;
    // a key asks for lock up to what the grip can use at this speed, plus a little more
    // (enough to push the fronts past their peak) and always enough to point the wheels a
    // little past where the nose is sliding to
    const usable = (p.L * 1.15 * p.front.mu * G) / (v * v) + OVERDRIVE;
    const reach = Math.min(p.steerMax, Math.max(usable, Math.abs(theta) + OVERDRIVE));
    const dir =
      held.touchSteer !== 0 ? held.touchSteer : (held.left ? 1 : 0) - (held.right ? 1 : 0);
    if (dir !== 0) {
      this.steer = ramp(this.steer, dir * reach, STEER_RATE * dt, STEER_RATE * 2 * dt);
    } else {
      // hands relaxed: the wheel self-centres onto the direction the front axle travels
      // (castor), which by itself winds on opposite lock when the tail slides
      const rest = Math.max(-p.steerMax, Math.min(p.steerMax, theta));
      this.steer = ramp(this.steer, rest, RETURN_RATE * dt, RETURN_RATE * dt);
    }
  }
}

/** Move x toward target, at most `up` per call while growing in magnitude, `down` otherwise. */
function ramp(x: number, target: number, up: number, down: number): number {
  const growing = Math.abs(target) > Math.abs(x) && Math.sign(target) !== -Math.sign(x);
  const k = growing ? up : down;
  return x + Math.max(-k, Math.min(k, target - x));
}
