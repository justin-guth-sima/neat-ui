import { zoneAt } from './zones';

describe('the gauge zones', () => {
  it('says which zone a value is in: danger from its start, else warning from its start', () => {
    const zones = { warning: 85, danger: 100 };
    expect(zoneAt(84.9, zones)).toBeNull();
    expect(zoneAt(85, zones)).toBe('warning');
    expect(zoneAt(99, zones)).toBe('warning');
    expect(zoneAt(100, zones)).toBe('danger');
    expect(zoneAt(140, zones)).toBe('danger');
    expect(zoneAt(45, { warning: 50, danger: 40 })).toBe('danger');
    expect(zoneAt(null, zones)).toBeNull();
    expect(zoneAt(Number.NaN, zones)).toBeNull();
    expect(zoneAt(99, null)).toBeNull();
  });
});
