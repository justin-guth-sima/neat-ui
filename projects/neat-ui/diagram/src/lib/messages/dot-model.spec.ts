import type { NeatDiagramEdge } from '../model';
import {
  BATCH_SPREAD_MS,
  batchTimes,
  chainOf,
  DotEvery,
  DotModel,
  dotRadius,
  MAX_DOTS,
  MAX_TRAVEL_MS,
  MIN_TRAVEL_MS,
  type NeatDiagramMessageStep,
  TRAVEL_MS,
  travelTime,
} from './dot-model';
import { EdgeRates } from './rates';

describe('DotModel', () => {
  it('moves a dot to the end of its edge in its travel time (1200 ms unless set)', () => {
    const model = new DotModel();
    expect(model.travelMs).toBe(TRAVEL_MS);
    expect(TRAVEL_MS).toBe(1200);
    model.spawn('a', 1000, 5000);
    expect(model.advance(999)).toHaveLength(0);
    expect(model.advance(1000).map((d) => [d.edge, d.t])).toEqual([['a', 0]]);
    expect(model.advance(1600)[0].t).toBeCloseTo(0.5);
    expect(model.advance(1000 + TRAVEL_MS - 1)[0].t).toBeLessThan(1);
    expect(model.advance(1000 + TRAVEL_MS)).toHaveLength(0);
    expect(model.size).toBe(0);
  });

  it('applies a new travel time to the dots on their way too', () => {
    const model = new DotModel();
    model.spawn('a', 0, 5000);
    expect(model.advance(300)[0].t).toBeCloseTo(0.25);
    model.travelMs = 600;
    expect(model.advance(300)[0].t).toBeCloseTo(0.5);
    expect(model.advance(600)).toHaveLength(0);
  });

  it('forgets arrived dots and keeps the others in their order', () => {
    const model = new DotModel();
    model.spawn('a', 0, 1);
    model.spawn('b', 500, 1);
    model.spawn('c', 100, 1);
    model.spawn('d', 5000, 1);
    expect(model.advance(1250).map((d) => d.edge)).toEqual(['b', 'c']);
    expect(model.size).toBe(3);
    expect(model.advance(1350).map((d) => d.edge)).toEqual(['b']);
  });

  it('sizes a dot by its message bytes', () => {
    expect(dotRadius(100)).toBe(2);
    expect(dotRadius(1000)).toBe(2);
    expect(dotRadius(10_000)).toBeCloseTo(3.5);
    expect(dotRadius(100_000)).toBeCloseTo(5);
    expect(dotRadius(1_000_000)).toBeCloseTo(6.5);
    expect(dotRadius(100_000_000)).toBe(7);
    const model = new DotModel();
    model.spawn('a', 0, 10_000);
    expect(model.advance(0)[0].r).toBeCloseTo(3.5);
  });

  it('starts a step dot after its input has arrived and the stage time has passed', () => {
    const model = new DotModel();
    model.travelMs = 600;
    const delays: Record<string, number> = { s1: 20, s2: 5 };
    model.setChain(
      new Map([
        ['in', ['s1']],
        ['s1', ['s2']],
      ]),
      (edge) => delays[edge],
    );
    model.spawn('in', 0, 50_000, 2);
    // The input dot ends at 600 ms; s1 starts 20 ms later, s2 5 ms after s1 ends.
    expect(model.advance(600 + 19).map((d) => d.edge)).toEqual([]);
    const s1 = model.advance(600 + 20);
    expect(s1.map((d) => [d.edge, d.t, d.colour])).toEqual([['s1', 0, 2]]);
    expect(s1[0].r).toBeCloseTo(dotRadius(50_000));
    expect(model.advance(2 * 600 + 24)).toHaveLength(0);
    expect(model.advance(2 * 600 + 25).map((d) => d.edge)).toEqual(['s2']);
  });

  it('treats a stage time that is not a number as none', () => {
    const model = new DotModel();
    model.travelMs = 100;
    model.setChain(new Map([['in', ['s']]]), () => NaN);
    model.spawn('in', 0, 1);
    expect(model.advance(100).map((d) => d.edge)).toEqual(['s']);
  });

  it('stops a chain that loops after 32 steps', () => {
    const model = new DotModel();
    model.setChain(new Map([['loop', ['loop']]]), () => 0);
    model.spawn('loop', 0, 1);
    expect(model.size).toBe(33);
  });

  it('drops the oldest dot when the pool is full, and counts it', () => {
    const model = new DotModel(2);
    model.spawn('a', 0, 1);
    model.spawn('b', 0, 1);
    model.spawn('c', 0, 1);
    expect(model.size).toBe(2);
    expect(model.dropped).toBe(1);
    expect(model.advance(10).map((d) => d.edge)).toEqual(['b', 'c']);
    // Still in order after the pool has wrapped around and dots arrived in its middle.
    model.spawn('d', 5, 1);
    model.spawn('e', 900, 1);
    expect(model.dropped).toBe(3);
    expect(model.advance(1205).map((d) => d.edge)).toEqual(['e']);
    model.spawn('f', 1205, 1);
    expect(model.advance(1300).map((d) => d.edge)).toEqual(['e', 'f']);
  });

  it('holds a burst of pushes to its cap, keeping the newest', () => {
    expect(MAX_DOTS).toBe(16384);
    const model = new DotModel();
    for (let i = 0; i < 50_000; i++) model.spawn(`e${i % 7}`, i * 0.01, 1);
    expect(model.size).toBe(MAX_DOTS);
    expect(model.dropped).toBe(50_000 - MAX_DOTS);
    const dots = model.advance(500);
    expect(dots).toHaveLength(MAX_DOTS);
    expect(dots[dots.length - 1].edge).toBe(`e${49_999 % 7}`);
  });

  it('reuses its dot objects between frames', () => {
    const model = new DotModel();
    model.spawn('a', 0, 1);
    const first = model.advance(10)[0];
    const again = model.advance(20)[0];
    expect(again).toBe(first);
  });

  it('returns the same array every frame, as long as the dots on their way', () => {
    const model = new DotModel();
    model.spawn('a', 0, 1);
    model.spawn('b', 0, 1);
    model.spawn('c', 600, 1);
    const frame = model.advance(700);
    expect(frame.map((d) => d.edge)).toEqual(['a', 'b', 'c']);
    expect(model.advance(1300)).toBe(frame);
    expect(frame.map((d) => d.edge)).toEqual(['c']);
    model.spawn('d', 1300, 1);
    expect(model.advance(1400)).toBe(frame);
    expect(frame.map((d) => d.edge)).toEqual(['c', 'd']);
    expect(model.advance(5000)).toBe(frame);
    expect(frame).toHaveLength(0);
  });

  it('gives a message without a finite time no dot, no step dots and no listener call', () => {
    const told: string[] = [];
    const model = new DotModel(4, (edge) => told.push(edge));
    model.setChain(new Map([['in', ['s']]]), () => 0);
    model.spawn('a', 0, 1);
    for (const at of [NaN, Infinity, -Infinity]) model.spawn('in', at, 1);
    expect(model.size).toBe(1);
    expect(told).toEqual(['a']);
    // A step whose travel is not finite starts no dot after it either.
    model.setTravel(new Map([['in', NaN]]));
    model.spawn('in', 0, 1);
    expect(told).toEqual(['a', 'in']);
    expect(model.size).toBe(2);
    // And that dot, which could never arrive, is forgotten at once rather than kept.
    expect(model.advance(0).map((d) => d.edge)).toEqual(['a']);
    expect(model.size).toBe(1);
  });

  it('tells each spawn, step dots included, to its listener', () => {
    const seen: [string, number, number][] = [];
    const model = new DotModel(16, (edge, atMs, bytes) => seen.push([edge, atMs, bytes]));
    model.setChain(new Map([['in', ['s1']]]), () => 10);
    model.spawn('in', 100, 7);
    expect(seen).toEqual([
      ['in', 100, 7],
      ['s1', 100 + TRAVEL_MS + 10, 7],
    ]);
  });

  it('tells a spawn that drops the oldest dot to its listener all the same', () => {
    const seen: string[] = [];
    const model = new DotModel(1, (edge) => seen.push(edge));
    model.spawn('a', 0, 1);
    model.spawn('b', 0, 1);
    expect(seen).toEqual(['a', 'b']);
  });

  it('forgets every dot on clear', () => {
    const model = new DotModel();
    model.spawn('a', 0, 1);
    model.clear();
    expect(model.advance(1)).toHaveLength(0);
    expect(model.size).toBe(0);
  });
});

describe('chainOf', () => {
  const edges: Pick<NeatDiagramEdge, 'id' | 'from' | 'to'>[] = [
    { id: 'cam>slots', from: 'camera', to: 'slots' },
    { id: 'tf>slots', from: 'camera', to: 'slots' },
    { id: 'slots>dec', from: 'slots', to: 'dec' },
    { id: 'dec>pub', from: 'dec', to: 'pub' },
    { id: 'dec>log', from: 'dec', to: 'log' },
    { id: 'log>pub', from: 'log', to: 'pub' },
    { id: 'pub>host', from: 'pub', to: 'host' },
  ];
  const steps: Record<string, NeatDiagramMessageStep> = {
    'slots>dec': { from: 'board', stage: 'queue' },
    'dec>pub': { from: 'board', stage: 'neat', shares: 2 },
    'dec>log': { from: 'board', stage: 'neat', shares: 2, passive: true },
    'log>pub': { from: 'board', stage: 'log' },
  };

  it('follows an edge into the steps that leave the node it enters', () => {
    const next = chainOf(edges, steps);
    expect(next.get('cam>slots')).toEqual(['slots>dec']);
    expect(next.get('tf>slots')).toEqual(['slots>dec']);
    expect(next.get('slots>dec')).toEqual(['dec>pub', 'dec>log']);
  });

  it('ends a chain at a passive step and where no step leaves', () => {
    const next = chainOf(edges, steps);
    expect(next.has('dec>log')).toBe(false);
    expect(next.has('dec>pub')).toBe(false);
    expect(next.has('pub>host')).toBe(false);
  });

  it('ignores a step whose edge is not in the list', () => {
    const next = chainOf(edges, { ...steps, gone: { from: 'board', stage: 'x' } });
    expect([...next.values()].flat()).not.toContain('gone');
    expect(chainOf(edges, {}).size).toBe(0);
  });
});

describe('batchTimes', () => {
  it('spreads a batch over its own rhythm from its arrival', () => {
    expect(batchTimes([1000, 1010, 1045], 500)).toEqual([500, 510, 545]);
    expect(batchTimes([1045, 1000], 500)).toEqual([545, 500]);
  });

  it('keeps a stalled batch within its window', () => {
    expect(BATCH_SPREAD_MS).toBe(200);
    expect(batchTimes([0, 5000], 0)).toEqual([0, 200]);
  });

  it('starts a message without a finite time of its own at the arrival', () => {
    expect(batchTimes([1000, NaN, 1050], 500)).toEqual([500, 500, 550]);
    expect(batchTimes([NaN, Infinity], 500)).toEqual([500, 500]);
  });

  it('gives an empty batch no times', () => {
    expect(batchTimes([], 0)).toEqual([]);
  });
});

describe('DotEvery', () => {
  it('gives every message a dot at 1', () => {
    const every = new DotEvery();
    expect(Array.from({ length: 5 }, () => every.take('a'))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('gives every Nth message on an edge a dot, the first one included', () => {
    const every = new DotEvery();
    every.set(3);
    const got = Array.from({ length: 10 }, () => every.take('a'));
    expect(got).toEqual([true, false, false, true, false, false, true, false, false, true]);
  });

  it('counts each edge on its own', () => {
    const every = new DotEvery();
    every.set(2);
    // a's messages 1..3 get a dot, none, a dot; b's likewise.
    const order = ['a', 'b', 'a', 'a', 'b', 'b'];
    expect(order.map((edge) => every.take(edge))).toEqual([true, true, false, true, false, true]);
  });

  it('starts every edge again when N changes, and not when it stays', () => {
    const every = new DotEvery();
    every.set(3);
    expect([every.take('a'), every.take('a')]).toEqual([true, false]);
    every.set(3);
    expect(every.take('a')).toBe(false);
    every.set(2);
    expect([every.take('a'), every.take('a'), every.take('a')]).toEqual([true, false, true]);
    every.set(1);
    expect(every.take('a')).toBe(true);
  });

  it('takes whole numbers of at least 1', () => {
    const every = new DotEvery();
    every.set(0);
    expect(every.take('a') && every.take('a')).toBe(true);
    every.set(NaN);
    expect(every.take('a') && every.take('a')).toBe(true);
    every.set(2.4);
    expect([every.take('b'), every.take('b'), every.take('b')]).toEqual([true, false, true]);
  });
});

describe('messages without a dot', () => {
  it('are placed and told but not returned by advance, with their step dots', () => {
    const told: string[] = [];
    const model = new DotModel(16, (edge) => told.push(edge));
    model.setChain(new Map([['in', ['out']]]), () => 0);
    model.spawn('in', 0, 5000, 0, false);
    model.spawn('in', 0, 5000, 0, true);
    expect(told).toEqual(['in', 'out', 'in', 'out']);
    expect(model.spawned).toBe(2);
    expect(model.advance(10).map((d) => d.edge)).toEqual(['in']);
    // After the input dots arrived, only the visible one's step dot shows.
    expect(model.advance(TRAVEL_MS + 10).map((d) => d.edge)).toEqual(['out']);
  });

  it('keep the rates exact: every message counts, a dot or not', () => {
    const rates = new EdgeRates();
    const model = new DotModel(64, (edge, at, bytes) => rates.count(edge, bytes, at));
    const every = new DotEvery();
    every.set(10);
    for (let i = 0; i < 50; i++) model.spawn('a', 100 + i * 10, 1000, 0, every.take('a'));
    expect(rates.snapshot('a', 1000).msgsPerSec).toBe(50);
    expect(model.spawned).toBe(5);
  });
});

describe('constant-speed travel', () => {
  it('takes length over speed, clamped', () => {
    expect(travelTime(300, 300)).toBe(1000);
    expect(travelTime(600, 300)).toBe(2000);
    expect(travelTime(5, 300)).toBe(MIN_TRAVEL_MS);
    expect(travelTime(100_000, 300)).toBe(MAX_TRAVEL_MS);
    expect(travelTime(NaN, 300)).toBe(TRAVEL_MS);
    expect(travelTime(300, 0)).toBe(TRAVEL_MS);
  });

  it('does not cap a long edge at the default speed (a wide overview is about 2200 units)', () => {
    // At 270 units/s an edge keeps its speed up to 5400 units; at the slowest (50) up to 1000.
    expect(travelTime(2200, 270)).toBeCloseTo((2200 / 270) * 1000, 6);
    expect(travelTime(1000, 50)).toBe(20000);
  });

  it('gives each edge its own time and the fallback to others', () => {
    const model = new DotModel(16);
    model.setTravel(
      new Map([
        ['a', 500],
        ['b', 1000],
      ]),
    );
    model.spawn('a', 0, 100);
    model.spawn('b', 0, 100);
    model.spawn('c', 0, 100);
    const t = Object.fromEntries(model.advance(250).map((d) => [d.edge, d.t]));
    expect(t['a']).toBeCloseTo(0.5);
    expect(t['b']).toBeCloseTo(0.25);
    expect(t['c']).toBeCloseTo(250 / TRAVEL_MS);
  });

  it("starts a step dot when its input has arrived at its own edge's pace", () => {
    const model = new DotModel(16);
    model.setTravel(
      new Map([
        ['a', 500],
        ['s', 1000],
      ]),
    );
    model.setChain(new Map([['a', ['s']]]), () => 100);
    model.spawn('a', 0, 100);
    expect(model.advance(300).map((d) => d.edge)).toEqual(['a']);
    expect(model.advance(599)).toEqual([]);
    const dots = model.advance(600);
    expect(dots.map((d) => d.edge)).toEqual(['s']);
    expect(dots[0].t).toBeCloseTo(0);
  });
});
