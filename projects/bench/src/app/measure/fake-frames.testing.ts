import type { FrameScheduler } from './frame-recorder';

/** A rAF the specs drive: each `frame` runs the callbacks queued before it, at its timestamp. */
export class FakeFrames implements FrameScheduler {
  private queue = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;
  now = 1000;

  request(callback: FrameRequestCallback): number {
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
