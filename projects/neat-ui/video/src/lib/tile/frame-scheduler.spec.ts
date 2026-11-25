import { startFrameScheduler } from './frame-scheduler';
import type { NeatEncodedFrame, NeatEncodedFrames } from './tile-source';

/** requestAnimationFrame under the test's control. */
class FakeAnimationFrames {
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly canceled: number[] = [];
  private nextId = 1;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.canceled.push(id);
      this.callbacks.delete(id);
    });
  }

  run(now: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now);
  }
}

interface FakeBitmap {
  close: ReturnType<typeof vi.fn>;
}

/** createImageBitmap whose decodes the test settles, recording each Blob it was given. */
class FakeDecoder {
  readonly blobs: Blob[] = [];
  readonly bitmaps: FakeBitmap[] = [];
  private readonly settlers: {
    resolve: (bitmap: FakeBitmap) => void;
    reject: (e: unknown) => void;
  }[] = [];

  install(): void {
    vi.stubGlobal(
      'createImageBitmap',
      (blob: Blob) =>
        new Promise<FakeBitmap>((resolve, reject) => {
          this.blobs.push(blob);
          this.settlers.push({ resolve, reject });
        }),
    );
  }

  async resolve(index: number): Promise<void> {
    const bitmap: FakeBitmap = { close: vi.fn() };
    this.bitmaps[index] = bitmap;
    this.settlers[index].resolve(bitmap);
    await flush();
  }

  async reject(index: number, error: unknown): Promise<void> {
    this.settlers[index].reject(error);
    await flush();
  }
}

/** A run of frames the test feeds, recording its unsubscribes. */
class FakeRun implements NeatEncodedFrames {
  listener: ((frame: NeatEncodedFrame) => void) | null = null;
  unsubscribes = 0;

  onFrame(listener: (frame: NeatEncodedFrame) => void): () => void {
    this.listener = listener;
    return () => {
      this.unsubscribes += 1;
      this.listener = null;
    };
  }

  emit(frame: NeatEncodedFrame): void {
    this.listener?.(frame);
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const frame = (
  name: string,
  presentAt: number,
  rtpTimestamp: number | null = null,
): NeatEncodedFrame => ({
  data: new Blob([name]),
  rtpTimestamp,
  presentAt,
});

describe('startFrameScheduler', () => {
  let animationFrames: FakeAnimationFrames;
  let decoder: FakeDecoder;
  let run: FakeRun;
  let drawn: { bitmap: unknown; rtpTimestamp: number | null; now: number }[];
  let errors: unknown[];
  let onFrame: (frame: { bitmap: ImageBitmap; rtpTimestamp: number | null; now: number }) => void;

  const start = () =>
    startFrameScheduler(
      run,
      (decoded) => onFrame(decoded),
      (error) => errors.push(error),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    animationFrames = new FakeAnimationFrames();
    animationFrames.install();
    decoder = new FakeDecoder();
    decoder.install();
    run = new FakeRun();
    drawn = [];
    errors = [];
    onFrame = (decoded) => drawn.push(decoded);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('holds a frame until its presentAt', () => {
    start();
    run.emit(frame('a', 100));

    animationFrames.run(50);
    expect(decoder.blobs).toHaveLength(0);

    animationFrames.run(100);
    expect(decoder.blobs).toHaveLength(1);
  });

  it('decodes the newest due frame and drops the older due ones', () => {
    start();
    const frames = [frame('a', 0), frame('b', 10), frame('c', 20)];
    frames.forEach((f) => run.emit(f));

    animationFrames.run(30);

    expect(decoder.blobs).toStrictEqual([frames[2].data]);
  });

  it('runs one decode at a time', () => {
    start();
    run.emit(frame('a', 0));
    animationFrames.run(0);
    run.emit(frame('b', 0));
    animationFrames.run(1);

    expect(decoder.blobs).toHaveLength(1);
  });

  it('replaces the frame waiting with a newer one', async () => {
    start();
    const [a, b, c] = [frame('a', 0), frame('b', 1), frame('c', 2)];
    run.emit(a);
    animationFrames.run(0);
    run.emit(b);
    animationFrames.run(1);
    run.emit(c);
    animationFrames.run(2);

    await decoder.resolve(0);
    expect(decoder.blobs).toStrictEqual([a.data, c.data]);
  });

  it('draws frames in order', async () => {
    start();
    run.emit(frame('a', 0, 1000));
    animationFrames.run(0);
    run.emit(frame('b', 1, 2000));
    animationFrames.run(1);
    run.emit(frame('c', 2, 3000));
    animationFrames.run(2);

    vi.advanceTimersByTime(40);
    await decoder.resolve(0);
    vi.advanceTimersByTime(40);
    await decoder.resolve(1);

    expect(drawn.map((d) => [d.rtpTimestamp, d.now])).toStrictEqual([
      [1000, 40],
      [3000, 80],
    ]);
    expect(drawn[0].bitmap).toBe(decoder.bitmaps[0]);
  });

  it('closes every bitmap after onFrame, also when onFrame throws', async () => {
    onFrame = () => {
      throw new Error('draw failed');
    };
    start();
    run.emit(frame('a', 0));
    animationFrames.run(0);
    run.emit(frame('b', 1));
    animationFrames.run(1);

    await decoder.resolve(0);
    expect(decoder.bitmaps[0].close).toHaveBeenCalledOnce();
    expect(errors).toHaveLength(1);

    expect(decoder.blobs).toHaveLength(2);
    await decoder.resolve(1);
    expect(decoder.bitmaps[1].close).toHaveBeenCalledOnce();
  });

  it('closes a bitmap that resolves after stop, and calls nothing', async () => {
    const stop = start();
    run.emit(frame('a', 0));
    animationFrames.run(0);

    stop();
    await decoder.resolve(0);

    expect(decoder.bitmaps[0].close).toHaveBeenCalledOnce();
    expect(drawn).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('reports a rejected decode and decodes the next frame', async () => {
    start();
    run.emit(frame('a', 0));
    animationFrames.run(0);
    run.emit(frame('b', 1));
    animationFrames.run(1);

    const failure = new Error('bad jpeg');
    await decoder.reject(0, failure);

    expect(errors).toStrictEqual([failure]);
    expect(decoder.blobs).toHaveLength(2);
  });

  it('bounds the queue while no animation frame runs', () => {
    start();
    const frames = Array.from({ length: 100 }, (_, i) => frame(`f${i}`, i * 33));
    for (const f of frames) {
      run.emit(f);
      vi.advanceTimersByTime(33);
    }
    vi.advanceTimersByTime(2000);

    // The clock is past 5 s now. Frames more than the grace older than the last arrival (at
    // 3.2 s) were dropped as they came, so a step at 1 s, where the early frames were due, finds
    // none of them.
    animationFrames.run(1000);
    expect(decoder.blobs).toHaveLength(0);

    animationFrames.run(performance.now());
    expect(decoder.blobs).toStrictEqual([frames[99].data]);
  });

  it('requests no animation frame while nothing waits', () => {
    start();
    expect(animationFrames.callbacks.size).toBe(0);

    run.emit(frame('a', 0));
    expect(animationFrames.callbacks.size).toBe(1);

    animationFrames.run(0);
    expect(animationFrames.callbacks.size).toBe(0);

    run.emit(frame('b', 10));
    expect(animationFrames.callbacks.size).toBe(1);
  });

  it('ignores a frame that reaches its listener after stop', () => {
    // A run that keeps calling a listener it was told to drop.
    let listener: ((frame: NeatEncodedFrame) => void) | null = null;
    const leaky: NeatEncodedFrames = {
      onFrame: (l) => {
        listener = l;
        return () => undefined;
      },
    };
    const stop = startFrameScheduler(
      leaky,
      (decoded) => drawn.push(decoded),
      (error) => errors.push(error),
    );

    stop();
    listener!(frame('late', 0));

    expect(animationFrames.callbacks.size, 'it requests no animation frame').toBe(0);
    animationFrames.run(10);
    expect(decoder.blobs, 'it decodes nothing').toHaveLength(0);
  });

  it('goes on decoding when onDecodeError throws, and reports what it threw', async () => {
    const reported: unknown[] = [];
    vi.stubGlobal('reportError', (error: unknown) => reported.push(error));
    const thrown = new Error('handler failed');
    startFrameScheduler(
      run,
      (decoded) => drawn.push(decoded),
      () => {
        throw thrown;
      },
    );
    run.emit(frame('a', 0));
    animationFrames.run(0);
    run.emit(frame('b', 1));
    animationFrames.run(1);

    await decoder.reject(0, new Error('bad jpeg'));
    expect(reported).toStrictEqual([thrown]);
    expect(decoder.blobs, 'the frame that waited is decoded').toHaveLength(2);

    await decoder.resolve(1);
    run.emit(frame('c', 2));
    animationFrames.run(2);
    expect(decoder.blobs, 'a later frame still decodes').toHaveLength(3);
  });

  it('unsubscribes and cancels its animation frame when stopped', () => {
    const stop = start();
    run.emit(frame('a', 100));
    const [pending] = animationFrames.callbacks.keys();

    stop();

    expect(run.unsubscribes).toBe(1);
    expect(animationFrames.canceled).toStrictEqual([pending]);
    animationFrames.run(200);
    expect(decoder.blobs).toHaveLength(0);
  });
});
