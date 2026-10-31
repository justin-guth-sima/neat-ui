import { fingerprint } from './fingerprint.testing';
import { BATCH_MS, FRAME_BYTES, type FeedParams, MessageFeed, RESULT_BYTES } from './message-feed';

const EDGES = Array.from({ length: 30 }, (_, i) => `e${i}`);

interface Pushed {
  edge: string;
  bytes: number;
  atMs: number;
}

/** Every message the feed pushes in its next `batches` batches, in the order it pushes them. */
function collect(feed: MessageFeed, batches: number): Pushed[][] {
  return Array.from({ length: batches }, () => {
    const batch: Pushed[] = [];
    const count = feed.next((edge, bytes, atMs) => batch.push({ edge, bytes, atMs }));
    expect(count).toBe(batch.length);
    return batch;
  });
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

describe('MessageFeed', () => {
  const params: FeedParams = { edges: EDGES, msgsPerSec: 400, profile: 'demo-like', seed: 1 };

  it('spreads the total evenly over the edges in the uniform profile', () => {
    const feed = new MessageFeed({ ...params, profile: 'uniform' });

    for (const load of feed.loads) expect(load.rate).toBeCloseTo(400 / 30, 9);
    expect(sum(feed.loads.map((load) => load.rate))).toBeCloseTo(400, 9);
  });

  it('gives a fifth of the edges four fifths of the messages in the demo-like profile', () => {
    const feed = new MessageFeed(params);
    const heavy = feed.loads.filter((load) => load.kind === 'frames');

    expect(heavy.length).toBe(6);
    expect(sum(heavy.map((load) => load.rate))).toBeCloseTo(320, 9);
    expect(sum(feed.loads.map((load) => load.rate))).toBeCloseTo(400, 9);
  });

  it('picks the camera-like edges by the seed, the same ones in both profiles', () => {
    const frames = (feed: MessageFeed): string[] =>
      feed.loads.filter((load) => load.kind === 'frames').map((load) => load.edge);

    const demo = frames(new MessageFeed(params));

    expect(frames(new MessageFeed({ ...params, profile: 'uniform' }))).toEqual(demo);
    expect(frames(new MessageFeed({ ...params, seed: 2 }))).not.toEqual(demo);
    expect(demo).not.toEqual(EDGES.slice(0, 6));
  });

  it('lets one edge carry everything when there is only one', () => {
    const feed = new MessageFeed({ ...params, edges: ['only'] });

    expect(feed.loads).toEqual([{ edge: 'only', kind: 'frames', rate: 400, bytes: FRAME_BYTES }]);
  });

  it('keeps every edge’s long-run rate within 1 %', () => {
    const feed = new MessageFeed(params);
    const batches = collect(feed, 600); // 60 s
    const counts = new Map<string, number>();
    for (const message of batches.flat()) {
      counts.set(message.edge, (counts.get(message.edge) ?? 0) + 1);
    }

    for (const load of feed.loads) {
      const expected = load.rate * 60;
      expect(Math.abs((counts.get(load.edge) ?? 0) - expected)).toBeLessThanOrEqual(
        Math.max(1, expected * 0.01),
      );
    }
    expect(Math.abs(batches.flat().length - 400 * 60)).toBeLessThanOrEqual(400 * 60 * 0.01);
  });

  it('times each batch’s messages inside its 100 ms, spread over all of it', () => {
    const feed = new MessageFeed({ ...params, edges: ['a'], msgsPerSec: 200 });

    collect(feed, 5).forEach((batch, k) => {
      expect(batch.length).toBe(20);
      const times = batch.map((message) => message.atMs);
      for (const at of times) {
        expect(at).toBeGreaterThanOrEqual(k * BATCH_MS);
        expect(at).toBeLessThan((k + 1) * BATCH_MS);
      }
      expect(Math.max(...times) - Math.min(...times)).toBeGreaterThanOrEqual(90);
      expect(times).toEqual([...times].sort((x, y) => x - y));
    });
  });

  it('staggers edges of the same rate, so their dots do not leave together', () => {
    const feed = new MessageFeed({ ...params, profile: 'uniform', msgsPerSec: 300 });
    const [first] = collect(feed, 1);
    const firstTimes = new Set(
      EDGES.map((edge) => first.find((message) => message.edge === edge)?.atMs),
    );

    expect(firstTimes.size).toBe(EDGES.length);
  });

  it('sizes messages as camera frames or results, within 10 % jitter', () => {
    const feed = new MessageFeed(params);
    const kinds = new Map(feed.loads.map((load) => [load.edge, load.kind]));
    const bytes = collect(feed, 50).flat();

    for (const message of bytes) {
      const base = kinds.get(message.edge) === 'frames' ? FRAME_BYTES : RESULT_BYTES;
      expect(Number.isInteger(message.bytes)).toBe(true);
      expect(message.bytes).toBeGreaterThanOrEqual(base * 0.9);
      expect(message.bytes).toBeLessThanOrEqual(base * 1.1);
    }
    expect(new Set(bytes.map((message) => message.bytes)).size).toBeGreaterThan(100);
  });

  it('pushes the same sequence for a seed and another for another seed', () => {
    const run = (seed: number): Pushed[][] => collect(new MessageFeed({ ...params, seed }), 50);

    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
  });

  it('pushes the pinned sequence for seed 1, so runs on any machine and day compare', () => {
    // As the diagram's pin: re-pin only on purpose, since earlier results stop comparing.
    expect(fingerprint(collect(new MessageFeed(params), 50))).toBe('ad7a39f5');
  });

  it('pushes nothing at no load', () => {
    const feed = new MessageFeed({ ...params, msgsPerSec: 0 });

    expect(collect(feed, 10).flat()).toEqual([]);
  });

  it.each([
    ['a negative rate', { msgsPerSec: -1 }],
    ['a rate that is not a number', { msgsPerSec: Number.NaN }],
    ['messages without an edge to carry them', { edges: [] }],
  ])('refuses %s', (_, change: Partial<FeedParams>) => {
    expect(() => new MessageFeed({ ...params, ...change })).toThrow(RangeError);
  });
});
