import { BATCH_MS, MessageFeed } from '../synth/message-feed';
import { FeedDriver } from './feed-driver';

const EDGES = ['e0', 'e1', 'e2', 'e3', 'e4'];

/** What a sink was given, in order. */
type Pushed = [edge: string, bytes: number, atMs: number][];

describe('FeedDriver', () => {
  let now: number;
  const clock = () => now;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 5000;
  });

  afterEach(() => vi.useRealTimers());

  /** The messages a feed of `msgsPerSec` pushes in its first `batches` batches, from time 0. */
  function expected(msgsPerSec: number, batches: number): Pushed {
    const feed = new MessageFeed({ edges: EDGES, msgsPerSec, profile: 'demo-like', seed: 7 });
    const out: Pushed = [];
    for (let i = 0; i < batches; i++) {
      feed.next((edge, bytes, atMs) => out.push([edge, bytes, atMs]));
    }
    return out;
  }

  function driver(msgsPerSec: number, pushed: Pushed): FeedDriver {
    const feed = new MessageFeed({ edges: EDGES, msgsPerSec, profile: 'demo-like', seed: 7 });
    return new FeedDriver(feed, (edge, bytes, atMs) => pushed.push([edge, bytes, atMs]), clock);
  }

  it('pushes the first batch at once, on the clock from its start', () => {
    const pushed: Pushed = [];
    driver(200, pushed).start();

    const first = expected(200, 1);
    expect(first.length).toBeGreaterThan(0);
    expect(pushed).toEqual(first.map(([edge, bytes, atMs]) => [edge, bytes, 5000 + atMs]));
  });

  it('pushes each batch when its window opens, and none before', () => {
    const pushed: Pushed = [];
    driver(200, pushed).start();
    const after = (batches: number) => expected(200, batches).length;

    now += BATCH_MS - 1;
    vi.advanceTimersByTime(BATCH_MS - 1);
    expect(pushed).toHaveLength(after(1));

    now += 1;
    vi.advanceTimersByTime(1);
    expect(pushed).toHaveLength(after(2));
  });

  it('catches up batch by batch when its timer is late, so the sequence stays the seed’s', () => {
    const pushed: Pushed = [];
    driver(200, pushed).start();

    // The timer fires once, 450 ms late: batches 1 to 5 are due.
    now += 5 * BATCH_MS + 50;
    vi.advanceTimersByTime(BATCH_MS);

    expect(pushed).toEqual(
      expected(200, 6).map(([edge, bytes, atMs]) => [edge, bytes, 5000 + atMs]),
    );
  });

  it('pushes nothing once stopped, and stopping twice is harmless', () => {
    const pushed: Pushed = [];
    const feed = driver(200, pushed);
    feed.start();
    const before = pushed.length;

    feed.stop();
    feed.stop();
    now += 10 * BATCH_MS;
    vi.advanceTimersByTime(10 * BATCH_MS);

    expect(pushed).toHaveLength(before);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('refuses a second start, which would run two timers on one feed', () => {
    const feed = driver(200, []);
    feed.start();

    expect(() => feed.start()).toThrow(/already/);
  });
});
