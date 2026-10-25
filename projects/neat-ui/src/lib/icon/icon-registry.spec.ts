import { Camera, Pause, Play } from 'lucide';
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
    expect(NEAT_ICONS.pause).toEqual({ name: 'pause', node: Pause });
    expect(NEAT_ICONS.play).toEqual({ name: 'play', node: Play });
  });

  it('every entry is named after its key', () => {
    for (const name of NEAT_ICON_NAMES) expect(NEAT_ICONS[name].name).toBe(name);
  });

  it('no entry is a component class', () => {
    for (const name of NEAT_ICON_NAMES) expect(typeof NEAT_ICONS[name]).toBe('object');
  });
});
