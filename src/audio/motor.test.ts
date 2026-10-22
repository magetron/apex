/** EV drive-unit voice: tones locked to the shaft, the poles and the gears. */
import { describe, expect, test } from 'vitest';
import { getMotor, listMotors } from '../spec/catalog';
import { motorVoiceConfig } from './config';
import { MotorKernel } from './dsp/motorKernel';
import { NO_ADDONS } from './dsp/types';
import { FS, peak, renderMotor, renderVoice, tone } from './test/harness';

/** How far a line stands above the spectrum ±4% around it. */
function prominence(x: Float32Array, hz: number, start: number) {
  const at = tone(x, hz, start);
  const around = [0.96, 0.97, 1.03, 1.04].map((m) => tone(x, hz * m, start));
  return at / Math.max(...around);
}

describe.each(listMotors().map((m) => [m.id, m] as const))('%s', (_id, motor) => {
  const cfg = motorVoiceConfig(motor);
  const rpm = 6000;
  const r = renderMotor(cfg, { rpm, throttle: 0.7 });
  const f = MotorKernel.tones(cfg, rpm, 0.7);

  test('electrical frequency = pole pairs × shaft speed (plus slip for induction)', () => {
    const ratio = f.electrical / (rpm / 60);
    if (cfg.induction) {
      expect(ratio).toBeGreaterThan(motor.sound.polePairs);
      expect(ratio).toBeLessThan(motor.sound.polePairs * 1.05);
    } else expect(ratio).toBeCloseTo(motor.sound.polePairs, 9);
  });

  test('the whine is at 6× the electrical frequency (three-phase torque ripple)', () => {
    expect(prominence(r.mono, f.e6, r.start)).toBeGreaterThan(10);
  });

  test('inverter switching whine at its PWM frequency', () => {
    expect(prominence(r.mono, motor.sound.inverterHz, r.start)).toBeGreaterThan(10);
  });

  test('reduction-gear mesh whine (pinion teeth × shaft speed)', () => {
    expect(prominence(r.mono, f.mesh1, r.start)).toBeGreaterThan(10);
    expect(f.mesh1).toBeCloseTo(cfg.pinionTeeth * (rpm / 60), 6);
  });

  test('every line scales with shaft speed', () => {
    const r2 = renderMotor(cfg, { rpm: 2 * rpm, throttle: 0.7 });
    const f2 = MotorKernel.tones(cfg, 2 * rpm, 0.7);
    expect(f2.mesh1).toBeCloseTo(2 * f.mesh1, 6);
    expect(prominence(r2.mono, f2.e6, r2.start)).toBeGreaterThan(10);
  });

  test('bounded and finite', () => {
    const k = new MotorKernel(cfg, FS, { addons: { ...NO_ADDONS, avas: true } });
    const out = renderVoice(k, 0, 2, (t) => ({
      rpm: Math.abs(Math.sin(t * 3)) * motor.maxRpm * 1.2,
      throttle: t % 0.5 < 0.25 ? 1 : 0,
    }));
    expect(out.L.every(Number.isFinite)).toBe(true);
    expect(peak(out.L)).toBeLessThanOrEqual(0.9 + 1e-6);
  });
});

test('AVAS adds a low-speed tone and fades out as the car speeds up', () => {
  const cfg = motorVoiceConfig(getMotor('pmsm-rear'));
  const level = (rpm: number, avas: boolean) => {
    const k = new MotorKernel(cfg, FS, { addons: { ...NO_ADDONS, avas } });
    const out = renderVoice(k, 0, 0.5, () => ({ rpm, throttle: 0.2 }), 0.2);
    return tone(out.mono, 220 + rpm * 0.12, out.start);
  };
  expect(level(600, true)).toBeGreaterThan(10 * level(600, false));
  expect(level(4000, true)).toBeLessThan(1.5 * level(4000, false) + 1e-6);
});
