import { describeContrast, describeRatio } from './contrast';

describe('describeRatio', () => {
  it('shows two decimals and AA from 4.5:1', () => {
    expect(describeRatio(4.5)).toBe('4.50:1 AA');
    expect(describeRatio(4.49)).toBe('4.49:1 below AA');
    expect(describeRatio(19.5)).toBe('19.50:1 AA');
  });
});

describe('describeContrast', () => {
  it('measures two #rrggbb values in either case', () => {
    expect(describeContrast('#ffffff', '#B3541B')).toBe('5.00:1 AA');
  });

  it('is empty when a value is not #rrggbb, as without the kit stylesheet', () => {
    expect(describeContrast('', '#ffffff')).toBe('');
    expect(describeContrast('#ffffff', 'var(--x)')).toBe('');
  });
});
