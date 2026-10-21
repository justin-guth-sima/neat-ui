import { computedToHex, describeRatio } from './contrast';

describe('describeRatio', () => {
  it('shows two decimals and AA from 4.5:1', () => {
    expect(describeRatio(4.5)).toBe('4.50:1 AA');
    expect(describeRatio(4.49)).toBe('4.49:1 below AA');
    expect(describeRatio(19.5)).toBe('19.50:1 AA');
  });
});

describe('computedToHex', () => {
  it('converts a computed sRGB colour to upper-case #RRGGBB', () => {
    expect(computedToHex('rgb(1, 15, 14)')).toBe('#010F0E');
    expect(computedToHex('rgba(210, 103, 40, 1)')).toBe('#D26728');
  });

  it('returns undefined for anything else', () => {
    expect(computedToHex('')).toBeUndefined();
    expect(computedToHex('light-dark(var(--a), var(--b))')).toBeUndefined();
  });
});
