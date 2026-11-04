import { neatLabelColour } from './label-colour';

describe('neatLabelColour', () => {
  const labels = Array.from({ length: 10 }, (_, index) => `L${index}`);

  it('takes the series colour of the label’s index', () => {
    expect(neatLabelColour('L0', labels, [])).toBe('var(--neat-series-1)');
    expect(neatLabelColour('L7', labels, [])).toBe('var(--neat-series-8)');
  });

  it('starts the palette again after eight labels', () => {
    expect(neatLabelColour('L9', labels, [])).toBe('var(--neat-series-2)');
  });

  it('keeps a quiet label muted, even one that is in the colour order', () => {
    expect(neatLabelColour('L0', labels, ['L0'])).toBe('var(--muted-foreground)');
    expect(neatLabelColour('none', [], ['none'])).toBe('var(--muted-foreground)');
  });

  it('gives an unknown label the neutral chip colour', () => {
    expect(neatLabelColour('other', labels, [])).toBe('var(--neat-chip-neutral)');
  });
});
