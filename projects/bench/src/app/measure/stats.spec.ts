import {
  type FrameStats,
  frameStats,
  percentile,
  stepOutcome,
  tierOf,
  withPresented,
} from './stats';

const HZ60 = 1000 / 60;
const HZ30 = 1000 / 30;

/** `count` frames at `interval`, as a recorder hands them over. */
const steady = (count: number, interval = HZ60): Float64Array =>
  new Float64Array(count).fill(interval);

describe('percentile', () => {
  it('takes the nearest rank of sorted values', () => {
    const sorted = Float64Array.from({ length: 100 }, (_, i) => i + 1);

    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 95)).toBe(95);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
    expect(percentile(Float64Array.of(7, 9), 50)).toBe(7);
    expect(percentile(Float64Array.of(4), 99)).toBe(4);
  });
});

describe('frameStats', () => {
  it('describes a steady 60 Hz phase as 60 fps with nothing dropped', () => {
    const stats = frameStats(steady(180), 3000, HZ60);

    expect(stats.frames).toBe(180);
    expect(stats.fps).toBeCloseTo(60, 9);
    expect(stats.p50).toBeCloseTo(HZ60, 9);
    expect(stats.p95).toBeCloseTo(HZ60, 9);
    expect(stats.p99).toBeCloseTo(HZ60, 9);
    expect(stats.worst).toBeCloseTo(HZ60, 9);
    expect([stats.dropped, stats.droppedPct, stats.janks, stats.stalls]).toEqual([0, 0, 0, 0]);
  });

  it('counts a 50 ms frame as two dropped, a jank and a stall', () => {
    const deltas = steady(100);
    deltas[40] = 50;

    const stats = frameStats(deltas, 1700, HZ60);

    expect(stats.dropped).toBe(2);
    expect(stats.droppedPct).toBeCloseTo((2 / 102) * 100, 9);
    expect(stats.janks).toBe(1);
    expect(stats.stalls).toBe(1);
    expect(stats.worst).toBe(50);
  });

  it('judges frames against the measured interval, so 30 Hz drops nothing at 30 fps', () => {
    const stats = frameStats(steady(60, HZ30), 2000, HZ30);

    expect(stats.fps).toBeCloseTo(30, 9);
    expect(stats.dropped).toBe(0);
    expect(stats.janks).toBe(0);
  });

  it('drops no frame for jitter under half an interval', () => {
    const deltas = Float64Array.of(HZ60, 24, 10, HZ60);

    expect(frameStats(deltas, 100, HZ60).dropped).toBe(0);
  });

  it('counts janks over twice the interval and stalls from 50 ms', () => {
    const deltas = Float64Array.of(HZ60, 2 * HZ60, 2 * HZ60 + 0.1, 49.9, 50, 120);

    const stats = frameStats(deltas, 300, HZ60);

    expect(stats.janks).toBe(4);
    expect(stats.stalls).toBe(2);
  });

  it('describes a single frame by itself', () => {
    const stats = frameStats(Float64Array.of(HZ60), HZ60, HZ60);

    expect(stats.frames).toBe(1);
    expect(stats.fps).toBeCloseTo(60, 9);
    for (const value of [stats.p50, stats.p95, stats.p99, stats.worst]) {
      expect(value).toBe(HZ60);
    }
    expect([stats.dropped, stats.droppedPct, stats.janks, stats.stalls]).toEqual([0, 0, 0, 0]);
  });

  it('rounds half an interval up, so 1.5 intervals drop one refresh and 1.49 none', () => {
    // An interval of 10 ms keeps the ratios exact in floating point.
    expect(frameStats(Float64Array.of(15), 15, 10).dropped).toBe(1);
    expect(frameStats(Float64Array.of(14.9), 15, 10).dropped).toBe(0);
    expect(frameStats(Float64Array.of(25), 25, 10).dropped).toBe(2);
  });

  it.each([2, 3, 6])('drops k - 1 refreshes for a frame of exactly k = %i intervals', (k) => {
    expect(frameStats(Float64Array.of(10 * k), 10 * k, 10).dropped).toBe(k - 1);
  });

  it('takes fps from the window it is given, so a stretched phase is not flattered', () => {
    // A phase planned for 1000 ms whose last frame came 200 ms late ends at 1200 ms: the window
    // is the real span (see FrameRecorder.between), not the plan.
    const deltas = steady(59);
    deltas[58] = 1200 - 58 * HZ60;

    expect(frameStats(deltas, 1200, HZ60).fps).toBeCloseTo(59 / 1.2, 9);
    expect(frameStats(deltas, 1000, HZ60).fps).toBeCloseTo(59, 9);
  });

  it('sorts a copy and leaves the recorder’s buffer as it was', () => {
    const deltas = Float64Array.of(30, 10, 20);

    expect(frameStats(deltas, 60, HZ60).p50).toBe(20);
    expect(Array.from(deltas)).toEqual([30, 10, 20]);
  });

  it.each([
    ['a phase without a frame', new Float64Array(0), 1000, HZ60],
    ['a window that is not positive', steady(3), 0, HZ60],
    ['an interval that is not positive', steady(3), 1000, 0],
  ])('refuses %s', (_, deltas, windowMs, intervalMs) => {
    expect(() => frameStats(deltas, windowMs, intervalMs)).toThrow(RangeError);
  });
});

describe('tierOf', () => {
  const at = (change: Partial<FrameStats>): FrameStats => ({
    ...frameStats(steady(180), 3000, HZ60),
    ...change,
  });

  it('calls a phase smooth while p95 stays within 1.25 intervals and at most 5 % drop', () => {
    expect(tierOf(at({}), HZ60)).toBe('smooth');
    expect(tierOf(at({ p95: 1.25 * HZ60, droppedPct: 5 }), HZ60)).toBe('smooth');
    expect(tierOf(at({ p95: 1.25 * HZ60 + 0.01 }), HZ60)).toBe('usable');
    expect(tierOf(at({ droppedPct: 5.01 }), HZ60)).toBe('usable');
  });

  it('calls a phase usable from 30 fps with p99 within 100 ms, and failing below', () => {
    const rough = { p95: 40, droppedPct: 20 };

    expect(tierOf(at({ ...rough, fps: 30, p99: 100 }), HZ60)).toBe('usable');
    expect(tierOf(at({ ...rough, fps: 29.9, p99: 50 }), HZ60)).toBe('failing');
    expect(tierOf(at({ ...rough, fps: 45, p99: 100.1 }), HZ60)).toBe('failing');
  });
});

describe('withPresented', () => {
  const smooth = frameStats(steady(180), 3000, HZ60);

  it('keeps the recorder’s statistics where nothing was presented or the display kept up', () => {
    expect(withPresented(smooth, undefined, HZ60)).toBe(smooth);
    expect(withPresented(smooth, 60, HZ60)).toBe(smooth);
    expect(withPresented(smooth, 61.2, HZ60)).toBe(smooth);
  });

  it('takes the display’s lower rate, and the refreshes that showed nothing new as dropped', () => {
    // 54 of 60 refreshes drew a frame: 10 % showed nothing new.
    const seen = withPresented(smooth, 54, HZ60);

    expect(seen.fps).toBe(54);
    expect(seen.droppedPct).toBeCloseTo(10, 9);
    expect(tierOf(smooth, HZ60)).toBe('smooth');
    expect(tierOf(seen, HZ60)).toBe('usable');
  });

  it('keeps the larger of the recorder’s dropped share and the display’s', () => {
    const rough = { ...smooth, droppedPct: 20 };

    expect(withPresented(rough, 57, HZ60).droppedPct).toBe(20);
  });

  it('fails a phase the display showed under 30 times a second, whatever the recorder saw', () => {
    expect(tierOf(withPresented(smooth, 29, HZ60), HZ60)).toBe('failing');
    expect(tierOf(withPresented(smooth, 30, HZ60), HZ60)).toBe('usable');
  });

  it('measures the shortfall against the run’s own refresh rate', () => {
    const at30 = frameStats(steady(90, HZ30), 3000, HZ30);

    expect(withPresented(at30, 27, HZ30).droppedPct).toBeCloseTo(10, 9);
    expect(tierOf(withPresented(at30, 29.5, HZ30), HZ30)).toBe('smooth');
  });
});

describe('stepOutcome', () => {
  it('pools the phases’ frames for the mean fps and the median frame', () => {
    const outcome = stepOutcome(
      [
        { deltas: steady(180), windowMs: 3000 },
        { deltas: steady(30, 100), windowMs: 3000 },
      ],
      HZ60,
    );

    expect(outcome.meanFps).toBeCloseTo(210 / 6, 9);
    expect(outcome.p50Ms).toBeCloseTo(HZ60, 9);
  });

  it('rates the step by its worst phase, so smooth idling hides no rough pan', () => {
    const smooth = { deltas: steady(180), windowMs: 3000 };
    const usable = { deltas: steady(90, HZ30), windowMs: 3000 };
    const failing = { deltas: steady(15, 200), windowMs: 3000 };

    expect(stepOutcome([smooth, smooth], HZ60).tier).toBe('smooth');
    expect(stepOutcome([smooth, usable], HZ60).tier).toBe('usable');
    expect(stepOutcome([usable, failing, smooth], HZ60).tier).toBe('failing');
  });

  it('refuses a step without a phase', () => {
    expect(() => stepOutcome([], HZ60)).toThrow(RangeError);
  });
});
