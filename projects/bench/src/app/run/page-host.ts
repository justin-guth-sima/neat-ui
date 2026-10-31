import { type BenchHost, startMatches } from '../hosts/bench-host';
import type { BenchLoad } from '../hosts/bench-load';
import { type GestureTarget, GesturePlayer } from './gesture-player';
import { type LadderId, ladderStep } from './ladders';
import type { DriverHost } from './phase-driver';

/**
 * The phase driver's view of the page (`DriverHost`): a level becomes the ladder's load on the
 * shared `BenchLoad` (a new step object each time, so the hosts restart their message feed), and
 * the registered host supplies the view, its start transform and the gestures. `shape` wraps the
 * host's gestures before the player gets them: the harness's input replay puts its own there.
 */
export function pageDriverHost(
  host: BenchHost,
  load: BenchLoad,
  ladder: LadderId,
  seed: number,
  shape: (target: GestureTarget) => GestureTarget = (target) => target,
): DriverHost {
  return {
    apply: (level) => load.step.set(ladderStep(ladder, level, seed)),
    atStart: () => startMatches(host.gestures.transform(), host.startTransform()),
    fit: () => host.fit(),
    // After `apply`, so the empty spot is the step's diagram's.
    player: () => new GesturePlayer(shape(host.gestures), load.synth().freeSpot),
    params: (level) => {
      const { params, msgsPerSec } = ladderStep(ladder, level, seed);
      return { blocks: params.blocks, edges: params.edges, notes: params.notes, msgsPerSec };
    },
    transform: () => host.gestures.transform(),
    domNodes: () => document.getElementsByTagName('*').length,
  };
}
