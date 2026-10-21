import { NEAT_ICON_NAMES, NEAT_ICONS } from './icon-registry';

describe('NEAT_ICON_NAMES', () => {
  it('lists every registry key exactly once', () => {
    expect([...NEAT_ICON_NAMES].sort()).toEqual(Object.keys(NEAT_ICONS).sort());
    expect(new Set(NEAT_ICON_NAMES).size).toBe(NEAT_ICON_NAMES.length);
  });
});
