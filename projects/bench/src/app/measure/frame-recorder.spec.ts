import { calibrateRefresh, FrameRecorder, type FrameScheduler } from './frame-recorder';
import { frameStats } from './stats';

/** A rAF the specs drive: each `frame` runs the callbacks queued before it, at its timestamp. */
class FakeFrames implements FrameScheduler {
  readonly requested: FrameRequestCallback[] = [];
  private queue = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;
  now = 1000;

  request(callback: FrameRequestCallback): number {
    this.requested.push(callback);
    this.queue.set(this.nextHandle, callback);
    return this.nextHandle++;
  }

  cancel(handle: number): void {
    this.queue.delete(handle);
  }

  get pending(): number {
    return this.queue.size;
  }

  /** One vsync `ms` after the last: runs what was queued; what that queues waits for the next. */
  frame(ms: number): void {
    this.now += ms;
    const due = [...this.queue.values()];
    this.queue.clear();
    for (const callback of due) callback(this.now);
  }

  frames(count: number, ms: number): void {
    for (let i = 0; i < count; i++) this.frame(ms);
  }
}

const HZ60 = 1000 / 60;

describe('FrameRecorder', () => {
  let frames: FakeFrames;

  beforeEach(() => {
    frames = new FakeFrames();
  });

  it('records nothing until it starts, and asks for a frame once it does', () => {
    const recorder = new FrameRecorder({ scheduler: frames });

    frames.frame(10);
    expect(recorder.frames).toBe(0);

    recorder.start();
    expect(recorder.running).toBe(true);
    expect(frames.pending).toBe(1);
  });

  it('takes the deltas and the window of a phase from the rAF timestamps it was handed', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frame(10);
    const from = recorder.mark();
    frames.frame(16);
    frames.frame(20);
    frames.frame(50);
    const to = recorder.mark();

    const phase = recorder.between(from, to);

    expect(Array.from(phase.deltas)).toEqual([16, 20, 50]);
    expect(phase.windowMs).toBe(86);
  });

  it('gives a phase that stretched its real span, which is what frameStats must be handed', () => {
    // Planned 100 ms; a 220 ms frame ends it at 340 ms: the plan's 100 ms would report 4 frames
    // in 100 ms (40 fps) where the page showed 4 in 340 ms.
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frame(10);
    const from = recorder.mark();
    frames.frame(60);
    frames.frame(30);
    frames.frame(30);
    frames.frame(220);
    const phase = recorder.between(from, recorder.mark());

    expect(phase.windowMs).toBe(340);
    expect(frameStats(phase.deltas, phase.windowMs, HZ60).fps).toBeCloseTo((4 * 1000) / 340, 9);
  });

  it('ends a phase and starts the next on the same frame, so no frame falls between them', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frame(10);
    const a = recorder.mark();
    frames.frames(3, 10);
    const b = recorder.mark();
    frames.frames(2, 20);
    const c = recorder.mark();

    const first = recorder.between(a, b);
    const second = recorder.between(b, c);

    expect(first.deltas.length + second.deltas.length).toBe(5);
    expect(first.windowMs + second.windowMs).toBe(70);
  });

  it('hands over a copy, so the next phase cannot change the one handed over', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frame(10);
    const from = recorder.mark();
    frames.frame(10);
    const phase = recorder.between(from, recorder.mark());

    frames.frames(5, 99);
    recorder.reset();

    expect(Array.from(phase.deltas)).toEqual([10]);
  });

  it('allocates nothing per frame: one callback and one buffer for the whole run', () => {
    const recorder = new FrameRecorder({ scheduler: frames, capacity: 1000 });
    recorder.start();
    const buffer = recorder.buffer;

    frames.frames(500, 10);

    expect(new Set(frames.requested).size).toBe(1);
    expect(frames.requested).toHaveLength(501);
    expect(recorder.buffer).toBe(buffer);
    expect(recorder.buffer).toBeInstanceOf(Float64Array);
    expect(recorder.frames).toBe(500);
  });

  it('tells the hook each frame after recording it, so the hook can mark the frame', () => {
    const seen: [number, number][] = [];
    const recorder = new FrameRecorder({
      scheduler: frames,
      onFrame: (timeMs) => seen.push([timeMs, recorder.mark()]),
    });
    recorder.start();

    frames.frame(10);
    frames.frame(10);

    expect(seen).toEqual([
      [1010, 0],
      [1020, 1],
    ]);
  });

  it('stops asking for frames when stopped, and a new start begins a fresh recording', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frames(3, 10);

    recorder.stop();
    frames.frame(10);
    expect(recorder.running).toBe(false);
    expect(frames.pending).toBe(0);
    expect(recorder.frames).toBe(3);

    recorder.start();
    expect(recorder.frames).toBe(0);
    frames.frame(10);
    expect(recorder.frames).toBe(1);
  });

  it('refuses to start twice', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();

    expect(() => recorder.start()).toThrow(Error);
  });

  it('forgets its frames on reset and keeps running', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frames(4, 10);

    recorder.reset();
    frames.frame(10);

    expect(recorder.frames).toBe(1);
    expect(recorder.running).toBe(true);
  });

  it('refuses to mark before any frame, since a phase starts on a frame', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();

    expect(() => recorder.mark()).toThrow(Error);
  });

  it('refuses a phase that is out of order, empty or past what was recorded', () => {
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frames(3, 10);

    expect(() => recorder.between(1, 1)).toThrow(RangeError);
    expect(() => recorder.between(2, 1)).toThrow(RangeError);
    expect(() => recorder.between(-1, 1)).toThrow(RangeError);
    expect(() => recorder.between(0, 3)).toThrow(RangeError);
  });

  it('does not pass a full buffer quietly: the hook still hears, phases are refused', () => {
    const hook = vi.fn();
    const recorder = new FrameRecorder({ scheduler: frames, capacity: 4, onFrame: hook });
    recorder.start();

    frames.frames(6, 10);

    expect(recorder.frames).toBe(4);
    expect(recorder.overflowed).toBe(true);
    expect(hook).toHaveBeenCalledTimes(6);
    expect(() => recorder.between(0, 3)).toThrow(RangeError);

    recorder.reset();
    expect(recorder.overflowed).toBe(false);
  });

  it('refuses a capacity that holds no phase', () => {
    expect(() => new FrameRecorder({ scheduler: frames, capacity: 1 })).toThrow(RangeError);
  });
});

describe('calibrateRefresh', () => {
  const calm = (count: number, ms: number): { deltas: Float64Array; windowMs: number } => ({
    deltas: new Float64Array(count).fill(ms),
    windowMs: count * ms,
  });

  it.each([
    [1000 / 30, 30],
    [1000 / 59.94, 60],
    [HZ60, 60],
    [1000 / 75.2, 75],
    [1000 / 119.9, 120],
    [1000 / 143.2, 144],
  ])('snaps a median of %f ms to %i Hz', (ms, hz) => {
    const refresh = calibrateRefresh(calm(120, ms));

    expect(refresh.hz).toBe(hz);
    expect(refresh.intervalMs).toBeCloseTo(1000 / hz, 9);
    expect(refresh.measuredMs).toBeCloseTo(ms, 9);
  });

  it('snaps to the nearest rate in Hz, not in ms', () => {
    // 57 Hz is 3 from 60 and 7 from 50.
    expect(calibrateRefresh(calm(120, 1000 / 57)).hz).toBe(60);
    expect(calibrateRefresh(calm(120, 1000 / 52)).hz).toBe(50);
  });

  it('takes the median, so a few hitches in the two seconds do not move it', () => {
    const deltas = new Float64Array(120).fill(1000 / 120);
    deltas.fill(80, 10, 30);
    deltas[0] = 400;

    expect(calibrateRefresh({ deltas, windowMs: 2000 }).hz).toBe(120);
  });

  it('keeps the median of an even count between the two middle frames', () => {
    const deltas = Float64Array.from({ length: 40 }, (_, i) => (i < 20 ? 16 : 17));

    expect(calibrateRefresh({ deltas, windowMs: 660 }).measuredMs).toBeCloseTo(16.5, 9);
  });

  it('refuses too few frames: a hidden tab or a stalled page measures nothing', () => {
    expect(() => calibrateRefresh(calm(19, HZ60))).toThrow(RangeError);
    expect(() => calibrateRefresh(calm(0, HZ60))).toThrow(RangeError);
  });

  it('calibrates from what a recorder saw over two seconds of an empty page', () => {
    const frames = new FakeFrames();
    const recorder = new FrameRecorder({ scheduler: frames });
    recorder.start();
    frames.frame(10);
    const from = recorder.mark();
    frames.frames(120, 1000 / 30);

    expect(calibrateRefresh(recorder.between(from, recorder.mark())).hz).toBe(30);
  });
});
