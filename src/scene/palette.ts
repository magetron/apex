/**
 * One colour legend for every scene on the site. Engine is always amber, gearbox always blue…
 * so a visitor learns the code once.
 */
export type System =
  | 'engine'
  | 'combustion'
  | 'gearbox'
  | 'shaft'
  | 'diff'
  | 'coupling'
  | 'wheel'
  | 'wheel-driven'
  | 'battery'
  | 'motor'
  | 'body'
  | 'chassis'
  | 'suspension'
  | 'brake'
  | 'exhaust'
  | 'intake'
  | 'cooling'
  | 'fuel'
  | 'occupant'
  | 'luggage';

export const SYSTEM_COLORS: Record<System, string> = {
  engine: '#f4a261',
  combustion: '#ff7b00',
  gearbox: '#4ea8de',
  shaft: '#ffd166',
  diff: '#d16ba5',
  coupling: '#e58fd6',
  wheel: '#8d99ae',
  'wheel-driven': '#06d6a0',
  battery: '#2ec4b6',
  motor: '#4cc9f0',
  body: '#a9c4e0',
  chassis: '#5c677d',
  suspension: '#adb5bd',
  brake: '#ef476f',
  exhaust: '#c97b63',
  intake: '#a3b18a',
  cooling: '#48cae4',
  fuel: '#e76f51',
  occupant: '#e9ecef',
  luggage: '#cdb4db',
};

export const SYSTEM_LABELS: Record<System, string> = {
  engine: 'Engine',
  combustion: 'Combustion',
  gearbox: 'Gearbox / transaxle',
  shaft: 'Shafts',
  diff: 'Differentials',
  coupling: 'Couplings / centre diff',
  wheel: 'Wheels (not driven)',
  'wheel-driven': 'Driven wheels',
  battery: 'Battery',
  motor: 'Electric motors',
  body: 'Body',
  chassis: 'Chassis',
  suspension: 'Suspension',
  brake: 'Brakes',
  exhaust: 'Exhaust',
  intake: 'Intake',
  cooling: 'Cooling',
  fuel: 'Fuel',
  occupant: 'Occupants',
  luggage: 'Luggage space',
};
