import { describe, expect, it } from 'vitest';
import { FrameLoop, type FrameLoopHost } from './frame-loop';

/** A clock the spec steps by hand, and a document whose visibility it sets. */
function host() {
  let now = 0;
  let next = 1;
  let queued = new Map<number, () => void>();
  const listeners = new Set<() => void>();
  let stops = 0;
  const document = {
    hidden: false,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.delete(listener);
    },
  };
  const clock = {
    now: () => now,
    request(callback: () => void) {
      queued.set(next, callback);
      return next++;
    },
    cancel(handle: number) {
      queued.delete(handle);
    },
  };
  const deps: FrameLoopHost = {
    clock,
    document: document as unknown as Document,
    stopped: () => stops++,
  };
  return {
    deps,
    frame(ms = 16) {
      now += ms;
      const due = queued;
      queued = new Map();
      for (const callback of due.values()) callback();
    },
    pending: () => queued.size > 0,
    setHidden(hidden: boolean) {
      document.hidden = hidden;
      for (const listener of listeners) listener();
    },
    listeners,
    stops: () => stops,
  };
}

describe('FrameLoop', () => {
  it('requests no frame while the page is hidden', () => {
    const h = host();
    let frames = 0;
    const loop = new FrameLoop(
      h.deps,
      () => frames++,
      () => true,
    );
    h.setHidden(true);
    loop.start();
    expect(h.pending()).toBe(false);
    h.frame();
    expect(frames).toBe(0);
    loop.destroy();
  });

  it('starts again by itself when the page shows', () => {
    const h = host();
    let frames = 0;
    const loop = new FrameLoop(
      h.deps,
      () => frames++,
      () => true,
    );
    loop.start();
    h.frame();
    expect(frames).toBe(1);
    h.setHidden(true);
    h.frame();
    expect(frames).toBe(1);
    expect(h.pending()).toBe(false);
    h.setHidden(false);
    expect(h.pending()).toBe(true);
    h.frame();
    expect(frames).toBe(2);
    loop.destroy();
  });

  it('calls stopped once a frame leaves nothing to move', () => {
    const h = host();
    let left = 3;
    const loop = new FrameLoop(
      h.deps,
      () => left--,
      () => left > 0,
    );
    loop.start();
    h.frame();
    h.frame();
    expect(h.stops()).toBe(0);
    h.frame();
    expect(h.stops()).toBe(1);
    expect(h.pending()).toBe(false);
    expect(loop.active).toBe(false);
    loop.destroy();
  });

  it('works without a stopped callback', () => {
    const h = host();
    let left = 1;
    const loop = new FrameLoop(
      { clock: h.deps.clock, document: h.deps.document },
      () => left--,
      () => left > 0,
    );
    loop.start();
    expect(() => h.frame()).not.toThrow();
    loop.destroy();
  });

  it('fresh is false while hidden and for 100 ms after showing', () => {
    const h = host();
    const loop = new FrameLoop(
      h.deps,
      () => undefined,
      () => false,
    );
    expect(loop.fresh()).toBe(true);
    h.setHidden(true);
    expect(loop.fresh()).toBe(false);
    h.setHidden(false);
    expect(loop.fresh()).toBe(false);
    h.frame(100);
    expect(loop.fresh()).toBe(false);
    h.frame(1);
    expect(loop.fresh()).toBe(true);
    loop.destroy();
  });

  it('destroy cancels the frame and the listener', () => {
    const h = host();
    let frames = 0;
    const loop = new FrameLoop(
      h.deps,
      () => frames++,
      () => true,
    );
    loop.start();
    expect(h.pending()).toBe(true);
    loop.destroy();
    expect(h.pending()).toBe(false);
    expect(h.listeners.size).toBe(0);
    h.frame();
    expect(frames).toBe(0);
  });
});
