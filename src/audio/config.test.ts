/** Spec → voice config: grouping, headers, turbo, add-on availability. */
import { describe, expect, test } from 'vitest';
import { getEngine, getMotor, listEngines } from '../spec/catalog';
import { firingEvents, headCylinders } from '../spec/derive/firing';
import { availableAddons, defaultAddons, engineVoiceConfig, isMotor, voiceConfig } from './config';

describe('engineVoiceConfig', () => {
  // (rotaries fire twice a cycle per rotor: rotary.test.ts)
  test.each(listEngines().flatMap((e) => (e.family === 'rotary' ? [] : [[e.id, e] as const])))(
    '%s: firing angles straight from firingEvents()',
    (_id, e) => {
      const cfg = engineVoiceConfig(e);
      for (const ev of firingEvents(e)) expect(cfg.fireDeg[ev.cyl]).toBe(ev.deg);
      expect(cfg.headerMm).toHaveLength(e.cylinders.length);
      expect(cfg.group).toHaveLength(e.cylinders.length);
      expect(cfg.gain).toBeGreaterThan(0);
    },
  );

  test('per-bank collectors follow the cylinder heads', () => {
    const v8 = getEngine('v8-cross');
    const cfg = engineVoiceConfig(v8);
    expect(cfg.groupCount).toBe(2);
    for (const head of [0, 1])
      for (const c of headCylinders(v8, head)) expect(cfg.group[c]).toBe(head);
    expect(engineVoiceConfig(getEngine('w16')).group.filter((g) => g === 1)).toHaveLength(8);
    // a VR6 has one head, so even "per-bank" would be one collector
    expect(engineVoiceConfig(getEngine('vr6'), { collector: 'per-bank' }).groupCount).toBe(1);
    expect(engineVoiceConfig(getEngine('v8-cross'), { collector: 'single' }).groupCount).toBe(1);
    expect(engineVoiceConfig(getEngine('v8-cross'), { collector: 'crossover' }).crossover).toBe(
      true,
    );
  });

  test('unequal headers pass through per cylinder; one number fills every cylinder', () => {
    expect(engineVoiceConfig(getEngine('flat4')).headerMm).toEqual([380, 680, 420, 720]);
    expect(engineVoiceConfig(getEngine('v10')).headerMm).toEqual(new Array(10).fill(560));
  });

  test('turbo parameters come from the spec; NA engines have none', () => {
    expect(engineVoiceConfig(getEngine('flat4')).turbo).toEqual({
      count: 1,
      spoolRpm: 3000,
      maxShaftKrpm: 170,
      // rally heritage: its blow-off valve vents to the air
      ventsToAir: true,
    });
    expect(engineVoiceConfig(getEngine('i6')).turbo?.ventsToAir).toBe(false);
    expect(engineVoiceConfig(getEngine('w16')).turbo?.count).toBe(4);
    expect(engineVoiceConfig(getEngine('v12')).turbo).toBeNull();
  });

  test('block vibration orders come from balance(): an I6 has none, an I4 shakes at 2nd order', () => {
    const lvl = (id: string, k: number) =>
      engineVoiceConfig(getEngine(id)).orders.find((o) => o.order === k)!.level;
    expect(lvl('i6', 1)).toBe(0);
    expect(lvl('i6', 2)).toBe(0);
    expect(lvl('i4', 2)).toBeGreaterThan(0.05);
    expect(lvl('i3', 1)).toBeGreaterThan(0);
  });
});

describe('add-ons', () => {
  test('turbo engines offer the turbo add-ons, NA engines only crackle, motors AVAS', () => {
    expect(availableAddons(getEngine('i4'))).toEqual([
      'spool',
      'wastegate',
      'bov',
      'antiLag',
      'crackle',
    ]);
    expect(availableAddons(getEngine('v8-flat'))).toEqual(['crackle']);
    expect(availableAddons(getMotor('pmsm-rear'))).toEqual(['avas']);
  });

  test('defaults follow what the real engine has', () => {
    // rally heritage: the turbo is part of the show
    expect(defaultAddons(getEngine('flat4'))).toMatchObject({
      spool: true,
      bov: true,
      // offered, but never on by default: it bangs whenever the throttle is shut
      antiLag: false,
    });
    // a road car's silencing hides its turbo (the chip is still offered)
    expect(defaultAddons(getEngine('i3-city'))).toMatchObject({
      spool: false,
      bov: false,
      antiLag: false,
    });
    expect(availableAddons(getEngine('i3-city'))).toContain('spool');
    expect(defaultAddons(getEngine('v12'))).toMatchObject({ spool: false, bov: false });
  });

  test('road turbo cars: no whine by default; BOV only where the spec has one; burble by output', () => {
    // BMW Z4 M40i (B58), Porsche 911 Carrera S (992), Audi RS 6 (C8), Bugatti Chiron
    for (const id of ['i6', 'flat6', 'v8-ea825', 'w16']) {
      const e = getEngine(id);
      expect(defaultAddons(e), id).toEqual({
        spool: false,
        wastegate: false,
        bov: e.sound.turbo?.bov ?? false,
        antiLag: false,
        crackle: true,
        avas: false,
      });
    }
  });

  test('motors and engines are told apart by their sound params', () => {
    expect(isMotor(getMotor('induction-front'))).toBe(true);
    expect(isMotor(getEngine('i4'))).toBe(false);
    expect(voiceConfig(getMotor('induction-front')).kind).toBe('motor');
  });
});
