import { PresentedFrame, startFrameLoop } from './frame-loop';

type FrameCallback = (now: number, metadata: Partial<VideoFrameCallbackMetadata>) => void;

/** A video element whose frames, ready state and decoded-frame count the test controls. */
class FakeVideo {
  readyState: number = HTMLMediaElement.HAVE_ENOUGH_DATA;
  totalVideoFrames = 0;
  readonly callbacks = new Map<number, FrameCallback>();
  readonly cancelled: number[] = [];
  private nextId = 1;

  constructor(private readonly withFrameCallbacks: boolean) {}

  get element(): HTMLVideoElement {
    const element = {
      readyState: 0,
      getVideoPlaybackQuality: () => ({ totalVideoFrames: this.totalVideoFrames }),
    } as unknown as HTMLVideoElement;
    Object.defineProperty(element, 'readyState', { get: () => this.readyState });
    if (this.withFrameCallbacks) {
      Object.assign(element, {
        requestVideoFrameCallback: (callback: FrameCallback) => {
          const id = this.nextId++;
          this.callbacks.set(id, callback);
          return id;
        },
        cancelVideoFrameCallback: (id: number) => {
          this.cancelled.push(id);
          this.callbacks.delete(id);
        },
      });
    }
    return element;
  }

  /** Presents a frame: every pending callback runs once, as the browser does. */
  present(now: number, metadata: Partial<VideoFrameCallbackMetadata> = {}): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now, metadata);
  }
}

/** requestAnimationFrame under the test's control. */
class FakeAnimationFrames {
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly cancelled: number[] = [];
  private nextId = 1;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.cancelled.push(id);
      this.callbacks.delete(id);
    });
  }

  run(now: number): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now);
  }
}

/** For loops whose callbacks without a current frame the test does not look at. */
const ignore = (): void => undefined;

describe('startFrameLoop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('with requestVideoFrameCallback', () => {
    it('reports each presented frame with its RTP timestamp, or null when it has none', () => {
      const video = new FakeVideo(true);
      const frames: PresentedFrame[] = [];
      startFrameLoop(video.element, (frame) => frames.push(frame), ignore);

      video.present(100, { rtpTimestamp: 90_000 });
      video.present(133, {});
      video.present(166, { rtpTimestamp: 0 });

      expect(frames).toStrictEqual([
        { now: 100, rtpTimestamp: 90_000 },
        { now: 133, rtpTimestamp: null },
        { now: 166, rtpTimestamp: 0 },
      ]);
    });

    it('reports a callback while the video holds no current frame apart from presented frames', () => {
      const video = new FakeVideo(true);
      const frames: PresentedFrame[] = [];
      let withoutFrame = 0;
      startFrameLoop(
        video.element,
        (frame) => frames.push(frame),
        () => (withoutFrame += 1),
      );

      video.readyState = HTMLMediaElement.HAVE_METADATA;
      video.present(100, { rtpTimestamp: 1 });
      video.readyState = HTMLMediaElement.HAVE_CURRENT_DATA;
      video.present(133, { rtpTimestamp: 2 });

      expect(frames.map((frame) => frame.rtpTimestamp)).toStrictEqual([2]);
      expect(withoutFrame).toBe(1);
    });

    it('keeps running when a frame handler throws', () => {
      const video = new FakeVideo(true);
      let calls = 0;
      startFrameLoop(
        video.element,
        () => {
          calls += 1;
          throw new Error('draw failed');
        },
        ignore,
      );

      expect(() => video.present(100)).toThrow('draw failed');
      expect(() => video.present(133)).toThrow('draw failed');
      expect(() => video.present(166)).toThrow('draw failed');
      expect(calls).toBe(3);
    });

    it('cancels its pending callback when stopped and reports nothing afterwards', () => {
      const video = new FakeVideo(true);
      const frames: PresentedFrame[] = [];
      const stop = startFrameLoop(video.element, (frame) => frames.push(frame), ignore);
      video.present(100);
      const [pending] = video.callbacks.keys();

      stop();
      video.present(133);

      expect(video.cancelled).toStrictEqual([pending]);
      expect(frames).toHaveLength(1);
    });

    it('stops cleanly from inside its own frame handler', () => {
      const video = new FakeVideo(true);
      let calls = 0;
      const stop = startFrameLoop(
        video.element,
        () => {
          calls += 1;
          stop();
        },
        ignore,
      );

      video.present(100);
      video.present(133);

      expect(calls).toBe(1);
      expect(video.callbacks.size).toBe(0);
    });
  });

  describe('without requestVideoFrameCallback', () => {
    let animationFrames: FakeAnimationFrames;

    beforeEach(() => {
      animationFrames = new FakeAnimationFrames();
      animationFrames.install();
    });

    it('reports a frame on each animation frame after the decoded-frame count advanced', () => {
      const video = new FakeVideo(false);
      const frames: PresentedFrame[] = [];
      startFrameLoop(video.element, (frame) => frames.push(frame), ignore);

      video.totalVideoFrames = 1;
      animationFrames.run(16);
      animationFrames.run(32);
      video.totalVideoFrames = 3;
      animationFrames.run(48);

      expect(frames).toStrictEqual([
        { now: 16, rtpTimestamp: null },
        { now: 48, rtpTimestamp: null },
      ]);
    });

    it('reports each animation frame while the video holds no current frame, and no decoded frame', () => {
      const video = new FakeVideo(false);
      const frames: PresentedFrame[] = [];
      let withoutFrame = 0;
      startFrameLoop(
        video.element,
        (frame) => frames.push(frame),
        () => (withoutFrame += 1),
      );

      video.readyState = HTMLMediaElement.HAVE_METADATA;
      video.totalVideoFrames = 1;
      animationFrames.run(16);
      animationFrames.run(32);

      expect(frames).toStrictEqual([]);
      expect(withoutFrame).toBe(2);
    });

    it('cancels its pending animation frame when stopped', () => {
      const video = new FakeVideo(false);
      const frames: PresentedFrame[] = [];
      const stop = startFrameLoop(video.element, (frame) => frames.push(frame), ignore);
      const [pending] = animationFrames.callbacks.keys();

      stop();
      video.totalVideoFrames = 1;
      animationFrames.run(16);

      expect(animationFrames.cancelled).toStrictEqual([pending]);
      expect(frames).toStrictEqual([]);
    });
  });
});
