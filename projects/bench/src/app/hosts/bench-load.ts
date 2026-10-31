import {
  afterRenderEffect,
  computed,
  inject,
  Injectable,
  type Signal,
  signal,
} from '@angular/core';
import { FeedDriver } from '../run/feed-driver';
import { MessageFeed, type MessageSink, type RateProfile } from '../synth/message-feed';
import { D1, type SynthParams, synthDiagram } from '../synth/synth-diagram';
import { sceneOf } from './scene';

/** One step's load (design 2.3): the diagram's counts and seed, and the messages on it. */
export interface LoadStep {
  readonly params: SynthParams;
  readonly msgsPerSec: number;
  readonly profile: RateProfile;
  /** Seeds the diagram and its messages alike. */
  readonly seed: number;
}

/** What a host draws until a run sets a step: D1 at ladder C's 400 messages per second. */
export const DEFAULT_STEP: LoadStep = {
  params: D1,
  msgsPerSec: 400,
  profile: 'demo-like',
  seed: 1,
};

/** The load every host draws: the run sets the step, the hosts draw what it makes. */
@Injectable({ providedIn: 'root' })
export class BenchLoad {
  readonly step = signal<LoadStep>(DEFAULT_STEP);

  /** The step's diagram's inputs; a step that changes the messages only keeps them. */
  private readonly shape = computed(
    () => ({ params: this.step().params, seed: this.step().seed }),
    { equal: (a, b) => a.params === b.params && a.seed === b.seed },
  );

  readonly synth = computed(() => synthDiagram(this.shape().params, this.shape().seed));
  /** The synthetic diagram as the hosts but the kit's draw it (scene.ts). */
  readonly scene = computed(() => sceneOf(this.synth()));
}

/** Where the feed pushes: the dot layer's `push(edgeId, bytes, atMs)`. */
export interface MessageLayer {
  push: MessageSink;
}

/**
 * Feeds the step's messages to the host's dot layer once it is rendered (the diagram it draws over
 * has its inputs then), from a new feed for each step, until the host is destroyed (call in its
 * constructor). The pushes run in the driver's timer, outside change detection, as a real feed's
 * handler would call `push`.
 */
export function feedMessages(layer: Signal<MessageLayer | undefined>): void {
  const load = inject(BenchLoad);
  afterRenderEffect((onCleanup) => {
    const target = layer();
    if (!target) return;
    const { msgsPerSec, profile, seed } = load.step();
    const feed = new MessageFeed({ edges: load.synth().messageEdges, msgsPerSec, profile, seed });
    const driver = new FeedDriver(feed, (edge, bytes, atMs) => target.push(edge, bytes, atMs));
    driver.start();
    onCleanup(() => driver.stop());
  });
}
