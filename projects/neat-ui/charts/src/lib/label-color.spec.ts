import { neatLabelColor, neatLabelColour } from './label-color';

describe('neatLabelColor', () => {
  const labels = Array.from({ length: 10 }, (_, index) => `L${index}`);

  it('takes the series color of the label’s index', () => {
    expect(neatLabelColor('L0', labels, [])).toBe('var(--neat-series-1)');
    expect(neatLabelColor('L7', labels, [])).toBe('var(--neat-series-8)');
  });

  it('starts the palette again after eight labels', () => {
    expect(neatLabelColor('L9', labels, [])).toBe('var(--neat-series-2)');
  });

  it('keeps a quiet label muted, even one that is in the color order', () => {
    expect(neatLabelColor('L0', labels, ['L0'])).toBe('var(--muted-foreground)');
    expect(neatLabelColor('none', [], ['none'])).toBe('var(--muted-foreground)');
  });

  it('gives an unknown label the neutral chip color', () => {
    expect(neatLabelColor('other', labels, [])).toBe('var(--neat-chip-neutral)');
  });
});

describe('neatLabelColour', () => {
  it('is the deprecated British name of neatLabelColor, the same function', () => {
    expect(neatLabelColour).toBe(neatLabelColor);
  });
});
