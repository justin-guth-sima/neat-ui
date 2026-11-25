import type { NeatEncodedFrame, NeatEncodedFrames } from './tile-source';

/** How long a frame stays queued after its `presentAt` has passed, in ms. */
export const FRAME_GRACE_MS = 1000;

/** One decoded picture, to be drawn at once: the bitmap is closed when `onFrame` returns. */
export interface DecodedFrame {
  readonly bitmap: ImageBitmap;
  readonly rtpTimestamp: number | null;
  /** When the decode finished, on the `performance.now()` clock. */
  readonly now: number;
}

/**
 * Holds a source's encoded frames until they are due, picks the newest due one on each animation
 * frame and decodes it, one decode at a time, for `onFrame` to draw. Internal to the tile: it
 * touches no Angular state, so the caller runs it outside Angular. It is `startFrameLoop`'s
 * counterpart for a source that has frames instead of a stream.
 *
 * Frames are queued in arrival order, and one whose `presentAt` lies more than `FRAME_GRACE_MS`
 * in the past is dropped from the front, so a hidden tab that runs no animation frames holds about
 * one hold plus a second of frames. An animation frame is requested only while frames wait. On
 * each, the newest frame whose `presentAt` has come is chosen and the older due ones are dropped,
 * so a tile that fell behind catches up instead of drifting.
 *
 * The picture is decoded with `createImageBitmap(Blob)`, which decodes off the main thread in
 * every browser the kit supports (`ImageDecoder` is not in all of them, a worker adds nothing to
 * an off-thread decode, and an `<img>` has no frame-exact completion). Only one decode runs at a
 * time, which bounds memory to one bitmap in flight and one frame waiting and keeps the frames in
 * order, since two decodes may resolve in either order: a frame chosen meanwhile becomes the
 * next one and replaces any that was waiting.
 *
 * `onFrame` draws synchronously; the bitmap is closed after it returns, also when it throws. A
 * decode that fails (`createImageBitmap` rejects) goes to `onDecodeError`; an `onFrame` that
 * throws is no decode failure and is reported to the page as an uncaught error would be
 * (`reportError`). Either way the next frame is decoded. An `onDecodeError` that throws is
 * reported the same way, and the scheduler goes on. The returned function stops it: it unsubscribes,
 * cancels the animation frame and empties the queue, a frame that still reaches its listener is
 * ignored, and a decode still in flight closes its bitmap and calls nothing.
 */
export function startFrameScheduler(
  frames: NeatEncodedFrames,
  onFrame: (frame: DecodedFrame) => void,
  onDecodeError: (error: unknown) => void,
): () => void {
  let stopped = false;
  let queue: NeatEncodedFrame[] = [];
  let animationFrame = 0;
  let decoding = false;
  let next: NeatEncodedFrame | null = null;

  const schedule = () => {
    if (animationFrame === 0 && queue.length > 0) animationFrame = requestAnimationFrame(tick);
  };

  const tick = (now: number) => {
    animationFrame = 0;
    let due = -1;
    queue.forEach((frame, index) => {
      if (frame.presentAt <= now) due = index;
    });
    if (due >= 0) {
      const chosen = queue[due];
      queue = queue.slice(due + 1);
      if (decoding) next = chosen;
      else void decode(chosen);
    }
    schedule();
  };

  const reportDecodeError = (error: unknown) => {
    try {
      onDecodeError(error);
    } catch (thrown) {
      reportError(thrown);
    }
  };

  const decode = async (frame: NeatEncodedFrame) => {
    decoding = true;
    try {
      const bitmap = await createImageBitmap(frame.data);
      try {
        if (!stopped) onFrame({ bitmap, rtpTimestamp: frame.rtpTimestamp, now: performance.now() });
      } catch (error) {
        // A draw that fails is no decode failure; it surfaces as an uncaught error does.
        reportError(error);
      } finally {
        bitmap.close();
      }
    } catch (error) {
      if (!stopped) reportDecodeError(error);
    } finally {
      decoding = false;
    }
    if (next && !stopped) {
      const following = next;
      next = null;
      void decode(following);
    }
  };

  const unsubscribe = frames.onFrame((frame) => {
    // A run that calls a listener after its unsubscribe must not restart a stopped scheduler.
    if (stopped) return;
    queue.push(frame);
    const oldest = performance.now() - FRAME_GRACE_MS;
    let stale = 0;
    while (stale < queue.length && queue[stale].presentAt < oldest) stale += 1;
    if (stale > 0) queue = queue.slice(stale);
    schedule();
  });

  return () => {
    stopped = true;
    unsubscribe();
    if (animationFrame !== 0) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    queue = [];
    next = null;
  };
}
