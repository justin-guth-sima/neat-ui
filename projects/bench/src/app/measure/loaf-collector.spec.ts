import {
  LoafCollector,
  type LoafEntry,
  type LoafScript,
  type ObserverConstructor,
} from './loaf-collector';

type Callback = (list: { getEntries(): readonly unknown[] }) => void;

/** A PerformanceObserver the specs drive: `deliver` is the browser handing entries over. */
function fakeObserver(supported: readonly string[]): ObserverConstructor & {
  instances: FakeObserver[];
} {
  class FakeObserver {
    static instances: FakeObserver[] = [];
    static readonly supportedEntryTypes = supported;
    observed: { type: string; buffered?: boolean }[] = [];
    disconnected = false;
    queue: unknown[] = [];

    constructor(private readonly callback: Callback) {
      FakeObserver.instances.push(this);
    }

    observe(options: { type: string; buffered?: boolean }): void {
      this.observed.push(options);
    }

    disconnect(): void {
      this.disconnected = true;
    }

    takeRecords(): unknown[] {
      return this.queue.splice(0);
    }

    deliver(entries: unknown[]): void {
      this.callback({ getEntries: () => entries });
    }
  }
  return FakeObserver as unknown as ObserverConstructor & { instances: FakeObserver[] };
}
interface FakeObserver {
  observed: { type: string; buffered?: boolean }[];
  disconnected: boolean;
  queue: unknown[];
  deliver(entries: unknown[]): void;
}

const script = (over: Partial<LoafScript> = {}): LoafScript => ({
  invoker: 'FrameRequestCallback',
  invokerType: 'user-callback',
  sourceURL: 'http://bench/main.js',
  sourceFunctionName: 'draw',
  sourceCharPosition: 100,
  duration: 10,
  forcedStyleAndLayoutDuration: 0,
  ...over,
});

/** A frame of `duration` from `startTime`; its style and layout take the last `styleLayout`. */
const frame = (
  startTime: number,
  duration: number,
  over: Partial<LoafEntry> & { styleLayout?: number } = {},
): LoafEntry => {
  const { styleLayout = 0, ...rest } = over;
  return {
    startTime,
    duration,
    blockingDuration: Math.max(0, duration - 50),
    renderStart: startTime + duration - styleLayout - 2,
    styleAndLayoutStart: startTime + duration - styleLayout,
    scripts: [script({ duration: 20 })],
    ...rest,
  };
};

describe('LoafCollector', () => {
  it('observes long animation frames when the browser has them', () => {
    const Observer = fakeObserver(['long-animation-frame', 'longtask', 'paint']);

    const collector = new LoafCollector(Observer);
    collector.start();

    expect(collector.source).toBe('long-animation-frame');
    expect(Observer.instances[0].observed).toEqual([{ type: 'long-animation-frame' }]);
  });

  it('falls back to long tasks, and says so', () => {
    const Observer = fakeObserver(['longtask']);

    const collector = new LoafCollector(Observer);
    collector.start();

    expect(collector.source).toBe('longtask');
    expect(Observer.instances[0].observed).toEqual([{ type: 'longtask' }]);
  });

  it('observes nothing where neither exists, and says so', () => {
    const Observer = fakeObserver(['paint']);

    const collector = new LoafCollector(Observer);
    collector.start();
    const summary = collector.summarize(0, 1000);

    expect(collector.source).toBe('none');
    expect(Observer.instances).toHaveLength(0);
    expect(summary).toMatchObject({ source: 'none', frames: 0, scripts: [] });
  });

  it('works without a PerformanceObserver at all', () => {
    const collector = new LoafCollector(undefined);

    collector.start();

    expect(collector.source).toBe('none');
    expect(collector.summarize(0, 1).frames).toBe(0);
  });

  it('counts the frames that started in a window, and none outside it', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([frame(90, 60), frame(100, 70), frame(199, 55), frame(200, 90)]);

    const summary = collector.summarize(100, 200);

    expect(summary.frames).toBe(2);
    expect(summary.totalMs).toBe(125);
    expect(summary.largestMs).toBe(70);
  });

  it('reads entries the browser has not delivered yet, once', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].queue.push(frame(100, 60));

    expect(collector.summarize(0, 1000).frames).toBe(1);
    expect(collector.summarize(0, 1000).frames).toBe(1);
  });

  it('sums the blocking time and keeps the largest', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([
      frame(0, 120, { blockingDuration: 70 }),
      frame(500, 80, { blockingDuration: 30 }),
    ]);

    const summary = collector.summarize(0, 1000);

    expect(summary.blockingTotalMs).toBe(100);
    expect(summary.blockingLargestMs).toBe(70);
  });

  it('splits a frame into script and style-and-layout time', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([
      frame(0, 100, {
        styleLayout: 30,
        scripts: [script({ duration: 40 }), script({ duration: 20 })],
      }),
    ]);

    const summary = collector.summarize(0, 1000);

    expect(summary.scriptMs).toBe(60);
    expect(summary.styleLayoutMs).toBe(30);
    expect(summary.styleLayoutShare).toBeCloseTo(30 / 90, 9);
  });

  it('counts no style and layout for a frame that reports no start for it', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([frame(0, 100, { styleAndLayoutStart: 0 })]);

    expect(collector.summarize(0, 1000).styleLayoutMs).toBe(0);
  });

  it('keys scripts by invoker, type, source, function and position, and sums each', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    const draw = script({ duration: 12, forcedStyleAndLayoutDuration: 2 });
    const moved = script({ duration: 8, sourceCharPosition: 900 });
    Observer.instances[0].deliver([
      frame(0, 60, { scripts: [draw, moved] }),
      frame(100, 60, { scripts: [{ ...draw, duration: 15, forcedStyleAndLayoutDuration: 5 }] }),
    ]);

    const { scripts } = collector.summarize(0, 1000);

    expect(scripts).toEqual([
      {
        invoker: 'FrameRequestCallback',
        invokerType: 'user-callback',
        sourceURL: 'http://bench/main.js',
        sourceFunctionName: 'draw',
        sourceCharPosition: 100,
        count: 2,
        durationMs: 27,
        forcedStyleAndLayoutMs: 7,
      },
      expect.objectContaining({ sourceCharPosition: 900, count: 1, durationMs: 8 }),
    ]);
  });

  it('keeps the top five scripts by summed duration, ties in key order', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    const scripts = [3, 9, 5, 7, 5, 1, 8].map((duration, i) =>
      script({ duration, sourceCharPosition: i }),
    );
    Observer.instances[0].deliver([frame(0, 60, { scripts })]);

    const top = collector.summarize(0, 1000).scripts;

    expect(top.map((s) => s.sourceCharPosition)).toEqual([1, 6, 3, 2, 4]);
  });

  it('reports a window with no long frame as zeroes and no share', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();

    expect(collector.summarize(0, 1000)).toEqual({
      source: 'long-animation-frame',
      frames: 0,
      totalMs: 0,
      largestMs: 0,
      blockingTotalMs: 0,
      blockingLargestMs: 0,
      scriptMs: 0,
      styleLayoutMs: 0,
      styleLayoutShare: null,
      scripts: [],
    });
  });

  it('reports long tasks by their duration only, as nothing else is known about them', () => {
    const Observer = fakeObserver(['longtask']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([
      { startTime: 10, duration: 70 },
      { startTime: 300, duration: 55 },
    ]);

    expect(collector.summarize(0, 1000)).toEqual({
      source: 'longtask',
      frames: 2,
      totalMs: 125,
      largestMs: 70,
      blockingTotalMs: null,
      blockingLargestMs: null,
      scriptMs: null,
      styleLayoutMs: null,
      styleLayoutShare: null,
      scripts: [],
    });
  });

  it('keeps a bounded number of entries and counts the ones it let go', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer, 3);
    collector.start();

    Observer.instances[0].deliver([0, 1, 2, 3, 4].map((i) => frame(i * 100, 60)));

    expect(collector.lost).toBe(2);
    expect(collector.summarize(0, 1000).frames).toBe(3);
  });

  it('forgets its entries on reset', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer, 3);
    collector.start();
    Observer.instances[0].deliver([0, 1, 2, 3].map((i) => frame(i * 100, 60)));

    collector.reset();

    expect(collector.lost).toBe(0);
    expect(collector.summarize(0, 1000).frames).toBe(0);
  });

  it('disconnects when stopped, and keeps what it saw', () => {
    const Observer = fakeObserver(['long-animation-frame']);
    const collector = new LoafCollector(Observer);
    collector.start();
    Observer.instances[0].deliver([frame(10, 60)]);

    collector.stop();

    expect(Observer.instances[0].disconnected).toBe(true);
    expect(collector.summarize(0, 1000).frames).toBe(1);
  });

  it('refuses a window that does not run forward', () => {
    const collector = new LoafCollector(fakeObserver(['long-animation-frame']));

    expect(() => collector.summarize(100, 100)).toThrow(RangeError);
  });
});
