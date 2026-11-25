/*
 * What the chat parts' specs share: a frame clock they step by hand. Internal, for specs only.
 */

/** A frame clock the spec steps: `frame(ms)` moves time on and runs the frames requested. */
export function steppedFrames() {
  let now = 1000;
  let next = 1;
  let queued = new Map<number, () => void>();
  return {
    now: () => now,
    request(callback: () => void) {
      queued.set(next, callback);
      return next++;
    },
    cancel(handle: number) {
      queued.delete(handle);
    },
    /** Moves time on by `ms` and runs the frames requested before. */
    frame(ms = 16) {
      now += ms;
      const due = queued;
      queued = new Map();
      for (const callback of due.values()) callback();
    },
    /** Whether a frame is waiting. */
    pending: () => queued.size > 0,
  };
}
