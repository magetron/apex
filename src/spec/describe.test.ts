import { expect, it } from 'vitest';
import { getEngine, getVehicle } from './catalog';
import { balance } from './derive';
import { balanceSummary, layoutCode, layoutSummary } from './describe';

it('layout codes', () => {
  expect(layoutCode(getVehicle('vw-golf-gti-mk8'))).toBe('FF');
  expect(layoutCode(getVehicle('bmw-m340i-g20'))).toBe('FR');
  expect(layoutCode(getVehicle('porsche-911-992'))).toBe('RR');
  expect(layoutCode(getVehicle('smart-fortwo-brabus-451'))).toBe('RR');
  expect(layoutCode(getVehicle('audi-r8-v10-gen2'))).toBe('M-AWD');
  expect(layoutCode(getVehicle('tesla-model3-awd'))).toBe('EV-AWD');
});

it('layout summary reads naturally', () => {
  expect(layoutSummary(getVehicle('vw-golf-gti-mk8'))).toMatch(
    /^Transverse .* ahead of the front axle · front-wheel drive$/,
  );
});

it('balance summary', () => {
  expect(balanceSummary(balance(getEngine('i6')))).toBe('Perfectly balanced');
  expect(balanceSummary(balance(getEngine('i4')))).toBe('2nd-order shake 4.0×');
});
