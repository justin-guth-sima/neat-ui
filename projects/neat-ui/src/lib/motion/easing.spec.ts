import { NEAT_EASINGS, type NeatEasingName } from './easing';

describe('NEAT_EASINGS', () => {
  const names = Object.keys(NEAT_EASINGS) as NeatEasingName[];

  it.each(names)('%s starts at 0 and ends at 1', (name) => {
    expect(NEAT_EASINGS[name](0)).toBe(0);
    expect(NEAT_EASINGS[name](1)).toBe(1);
  });

  it.each<[NeatEasingName, number]>([
    ['ease-in', 0.015625],
    ['ease-out', 0.578125],
    ['ease-in-out', 0.0625],
    ['linear', 0.25],
  ])('%s is %s a quarter of the way', (name, share) => {
    expect(NEAT_EASINGS[name](0.25)).toBeCloseTo(share, 10);
  });

  it('ease-in-out is symmetric: 0.9375 at three quarters', () => {
    expect(NEAT_EASINGS['ease-in-out'](0.75)).toBeCloseTo(0.9375, 10);
  });
});
