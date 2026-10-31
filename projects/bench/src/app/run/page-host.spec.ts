import { TestBed } from '@angular/core/testing';
import type { DiagramTransform } from '@bench/diagram-seam';
import type { BenchHost } from '../hosts/bench-host';
import { BenchLoad } from '../hosts/bench-load';
import { D1, scaledParams } from '../synth/synth-diagram';
import { ladderStep } from './ladders';
import { pageDriverHost } from './page-host';

describe('pageDriverHost', () => {
  let now: DiagramTransform;
  let start: DiagramTransform | null;
  let fits: number;
  const calls: string[] = [];

  const host = (): BenchHost => ({
    id: 'kit',
    gestures: {
      rect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }),
      transform: () => now,
      press: (x, y) => calls.push(`press ${Math.round(x)} ${Math.round(y)}`),
      drag: () => undefined,
      release: () => undefined,
      wheel: () => undefined,
    },
    startTransform: () => start,
    fit: () => fits++,
  });

  beforeEach(() => {
    now = { k: 1, x: 0, y: 0 };
    start = { k: 0.8, x: 100, y: 50 };
    fits = 0;
    calls.length = 0;
  });

  it('applies a level as the ladder’s load for the seed', () => {
    const load = TestBed.inject(BenchLoad);
    pageDriverHost(host(), load, 'A', 5).apply(4);

    expect(load.step()).toEqual(ladderStep('A', 4, 5));
    expect(load.step().params).toEqual(scaledParams(D1, 4));
  });

  it('applies the same level as a new step each time, so the feed restarts', () => {
    const load = TestBed.inject(BenchLoad);
    const driver = pageDriverHost(host(), load, 'B', 1);
    driver.apply(50);
    const first = load.step();
    driver.apply(50);
    expect(load.step()).not.toBe(first);
  });

  it('is at the start when the host’s transform is within the harness’s bounds of its start', () => {
    const driver = pageDriverHost(host(), TestBed.inject(BenchLoad), 'A', 1);
    expect(driver.atStart()).toBe(false);
    now = { k: 0.8, x: 101, y: 49 };
    expect(driver.atStart()).toBe(true);
    start = null;
    expect(driver.atStart()).toBe(false);
  });

  it('fits through the host and reads the view from its gestures’ transform', () => {
    const driver = pageDriverHost(host(), TestBed.inject(BenchLoad), 'A', 1);
    driver.fit();
    expect(fits).toBe(1);
    expect(driver.transform()).toBe(now);
  });

  it('gives each step a player that presses where the step’s diagram is empty', () => {
    const load = TestBed.inject(BenchLoad);
    const driver = pageDriverHost(host(), load, 'A', 1);
    driver.apply(1);
    now = { k: 1, x: 0, y: 0 };
    const player = driver.player();
    player.begin('pan', 0, 3000);

    const { freeSpot } = load.synth();
    expect(calls).toEqual([`press ${Math.round(freeSpot.x)} ${Math.round(freeSpot.y)}`]);
  });

  it('describes a level’s load for the result', () => {
    const driver = pageDriverHost(host(), TestBed.inject(BenchLoad), 'D', 1);
    expect(driver.params(2)).toEqual({
      blocks: scaledParams(D1, 2).blocks,
      edges: scaledParams(D1, 2).edges,
      notes: scaledParams(D1, 2).notes,
      msgsPerSec: 800,
    });
  });

  it('counts the page’s elements', () => {
    const driver = pageDriverHost(host(), TestBed.inject(BenchLoad), 'A', 1);
    expect(driver.domNodes()).toBe(document.getElementsByTagName('*').length);
  });
});
