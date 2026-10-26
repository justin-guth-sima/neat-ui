import { Camera } from 'lucide';
import { NEAT_ICON_NAMES, NEAT_ICONS } from './icon-registry';

describe('NEAT_ICON_NAMES', () => {
  it('lists every registry key exactly once', () => {
    expect([...NEAT_ICON_NAMES].sort()).toEqual(Object.keys(NEAT_ICONS).sort());
    expect(new Set(NEAT_ICON_NAMES).size).toBe(NEAT_ICON_NAMES.length);
  });
});

describe('NEAT_ICONS', () => {
  it('each entry is the plain drawing named after its key', () => {
    expect(NEAT_ICONS.camera).toEqual({ name: 'camera', node: Camera });
  });

  it('draws stop as a square, like aspect-square but filled', () => {
    expect(NEAT_ICON_NAMES).toContain('stop');
    expect(NEAT_ICONS.stop.name).toBe('stop');
    expect(
      NEAT_ICONS.stop.node.map(([tag, attrs]) => [tag, attrs['width'], attrs['height']]),
    ).toEqual(
      NEAT_ICONS['aspect-square'].node.map(([tag, attrs]) => [
        tag,
        attrs['width'],
        attrs['height'],
      ]),
    );
  });

  it('fills every shape of the three media glyphs, so a two-bar pause is solid in both bars', () => {
    for (const name of ['play', 'pause', 'stop'] as const) {
      expect(NEAT_ICONS[name].node.length, name).toBeGreaterThan(0);
      for (const [, attrs] of NEAT_ICONS[name].node)
        expect(attrs['fill'], name).toBe('currentColor');
    }
  });

  it('leaves the square outline unfilled, though stop is drawn from the same Lucide glyph', () => {
    for (const [, attrs] of NEAT_ICONS['aspect-square'].node) expect(attrs['fill']).toBeUndefined();
  });

  it('every entry is named after its key', () => {
    for (const name of NEAT_ICON_NAMES) expect(NEAT_ICONS[name].name).toBe(name);
  });

  it('no entry is a component class', () => {
    for (const name of NEAT_ICON_NAMES) expect(typeof NEAT_ICONS[name]).toBe('object');
  });
});
