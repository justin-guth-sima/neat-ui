import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageFeed } from '../synth/message-feed';
import { D1, scaledParams, synthDiagram } from '../synth/synth-diagram';
import { BenchLoad, DEFAULT_STEP, feedMessages, type MessageLayer } from './bench-load';

describe('BenchLoad', () => {
  it('draws D1 at 400 messages per second, demo-like, until a run sets a step', () => {
    const load = TestBed.inject(BenchLoad);

    expect(load.step()).toEqual(DEFAULT_STEP);
    expect(DEFAULT_STEP).toMatchObject({ params: D1, msgsPerSec: 400, profile: 'demo-like' });
    expect(load.synth()).toEqual(synthDiagram(D1, DEFAULT_STEP.seed));
  });

  it('keeps the diagram through a step that changes the messages only', () => {
    const load = TestBed.inject(BenchLoad);
    const before = load.synth();

    load.step.update((step) => ({ ...step, msgsPerSec: 800 }));
    expect(load.synth()).toBe(before);

    load.step.update((step) => ({ ...step, params: scaledParams(D1, 2) }));
    expect(load.synth()).not.toBe(before);
  });
});

/** Records what the feed pushes, as the dot layer would take it. */
class FakeLayer implements MessageLayer {
  readonly pushed: [string, number, number][] = [];
  push(edgeId: string, bytes: number, atMs: number): void {
    this.pushed.push([edgeId, bytes, atMs]);
  }
}

@Component({ template: '' })
class Feeding {
  readonly layer = signal<MessageLayer | undefined>(undefined);
  constructor() {
    feedMessages(this.layer);
  }
}

describe('feedMessages', () => {
  // Only the feed's interval is faked: change detection's own timers stay real.
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => vi.useRealTimers());

  /** The edges a step's first batch puts messages on, in push order. */
  function firstBatch(msgsPerSec: number): string[] {
    const { messageEdges } = TestBed.inject(BenchLoad).synth();
    const feed = new MessageFeed({ ...DEFAULT_STEP, msgsPerSec, edges: messageEdges });
    const edges: string[] = [];
    feed.next((edge) => edges.push(edge));
    return edges;
  }

  it('feeds the step’s messages to the layer once it exists, until the host is gone', async () => {
    const fixture = TestBed.createComponent(Feeding);
    await fixture.whenStable();
    expect(vi.getTimerCount()).toBe(0);

    const layer = new FakeLayer();
    fixture.componentInstance.layer.set(layer);
    await fixture.whenStable();
    expect(layer.pushed.map(([edge]) => edge)).toEqual(firstBatch(DEFAULT_STEP.msgsPerSec));
    expect(vi.getTimerCount()).toBe(1);

    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts a new feed for a new step, in place of the old one', async () => {
    const fixture = TestBed.createComponent(Feeding);
    const layer = new FakeLayer();
    fixture.componentInstance.layer.set(layer);
    await fixture.whenStable();
    layer.pushed.length = 0;

    TestBed.inject(BenchLoad).step.update((step) => ({ ...step, msgsPerSec: 800 }));
    await fixture.whenStable();

    expect(layer.pushed.map(([edge]) => edge)).toEqual(firstBatch(800));
    expect(vi.getTimerCount()).toBe(1);
  });
});
