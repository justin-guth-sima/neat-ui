import {
  LucideCamera,
  LucideCircuitBoard,
  LucideMic,
  LucideRadar,
  LucideRefreshCw,
  LucideSquareTerminal,
} from '@lucide/angular';
import { NEAT_ICON_NAMES, NEAT_ICONS } from './icon-registry';

describe('NEAT_ICON_NAMES', () => {
  it('lists every registry key exactly once', () => {
    expect([...NEAT_ICON_NAMES].sort()).toEqual(Object.keys(NEAT_ICONS).sort());
    expect(new Set(NEAT_ICON_NAMES).size).toBe(NEAT_ICON_NAMES.length);
  });
});

describe('NEAT_ICONS', () => {
  it('the registry has camera, microphone, lidar, device, refresh and terminal', () => {
    expect(NEAT_ICONS).toMatchObject({
      camera: LucideCamera,
      microphone: LucideMic,
      lidar: LucideRadar,
      device: LucideCircuitBoard,
      refresh: LucideRefreshCw,
      terminal: LucideSquareTerminal,
    });
  });
});
