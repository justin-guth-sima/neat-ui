import { DotProbeBuffer } from './dot-probe';

const MAX_DOTS = 1000;

describe('DotProbeBuffer', () => {
  it('summarises the draws since a mark: time p50, p95 and worst, dots p50 and largest', () => {
    const probe = new DotProbeBuffer(1000);
    probe.record(99, 1);
    const mark = probe.mark();
    for (let ms = 1; ms <= 100; ms++) probe.record(ms, ms * 5);

    const stats = probe.summarySince(mark, MAX_DOTS);

    expect(stats).toEqual({
      draws: 100,
      drawP50Ms: 50,
      drawP95Ms: 95,
      drawWorstMs: 100,
      dotsP50: 250,
      dotsMax: 500,
      capped: false,
    });
  });

  it('marks a phase as capped when the layer drew as many dots as it allows', () => {
    const probe = new DotProbeBuffer(10);
    const mark = probe.mark();
    probe.record(2, 400);
    probe.record(3, MAX_DOTS);

    expect(probe.summarySince(mark, MAX_DOTS).capped).toBe(true);
    expect(probe.summarySince(mark, MAX_DOTS + 1).capped).toBe(false);
  });

  it('reports a phase in which nothing was drawn as no numbers, not as zero milliseconds', () => {
    const probe = new DotProbeBuffer(10);
    probe.record(2, 5);

    expect(probe.summarySince(probe.mark(), MAX_DOTS)).toEqual({
      draws: 0,
      drawP50Ms: null,
      drawP95Ms: null,
      drawWorstMs: null,
      dotsP50: null,
      dotsMax: null,
      capped: false,
    });
  });

  it('keeps the newest draws when the ring wraps, and refuses what it overwrote', () => {
    const probe = new DotProbeBuffer(4);
    const early = probe.mark();
    for (let i = 1; i <= 6; i++) probe.record(i, i);
    const late = probe.mark();
    probe.record(7, 7);

    expect(probe.total).toBe(7);
    expect(() => probe.summarySince(early, MAX_DOTS)).toThrow(RangeError);
    expect(probe.summarySince(3, MAX_DOTS).draws).toBe(4);
    expect(probe.summarySince(3, MAX_DOTS).drawWorstMs).toBe(7);
    expect(probe.summarySince(late, MAX_DOTS).draws).toBe(1);
  });

  it('refuses a mark from the future', () => {
    const probe = new DotProbeBuffer(4);

    expect(() => probe.summarySince(1, MAX_DOTS)).toThrow(RangeError);
  });

  it('is one stable function writing into fixed buffers, so a frame allocates nothing', () => {
    const probe = new DotProbeBuffer(8);
    const { record, times, dots } = probe;

    for (let i = 0; i < 100; i++) probe.record(i, i);

    expect(probe.record).toBe(record);
    expect(probe.times).toBe(times);
    expect(probe.dots).toBe(dots);
    expect(times).toBeInstanceOf(Float64Array);
    expect(dots).toBeInstanceOf(Uint32Array);
  });

  it('can be handed to the layer as it is, without a bound this', () => {
    const probe = new DotProbeBuffer(8);
    const { record } = probe;

    record(4, 12);

    expect(probe.total).toBe(1);
  });

  it('sorts copies, leaving the ring as it was written', () => {
    const probe = new DotProbeBuffer(4);
    probe.record(30, 3);
    probe.record(10, 1);
    probe.record(20, 2);

    probe.summarySince(0, MAX_DOTS);

    expect(Array.from(probe.times.subarray(0, 3))).toEqual([30, 10, 20]);
  });

  it('forgets its draws on reset', () => {
    const probe = new DotProbeBuffer(4);
    probe.record(1, 1);

    probe.reset();

    expect(probe.total).toBe(0);
    expect(probe.summarySince(0, MAX_DOTS).draws).toBe(0);
  });

  it('refuses a capacity that holds no draw', () => {
    expect(() => new DotProbeBuffer(0)).toThrow(RangeError);
  });
});
