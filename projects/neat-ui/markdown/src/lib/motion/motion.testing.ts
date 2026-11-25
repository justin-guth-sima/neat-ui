import type { MotionHost } from './engine';

/*
 * What the engines' specs share: a clock they step frame by frame, a seeded random, a document
 * whose visibility they set, and a host built by hand in the shape the template renders. Internal,
 * for specs only.
 */

/** A frame clock the spec steps: `frame(ms)` moves time on and runs the frames requested. */
export function steppedFrames() {
  let now = 0;
  let next = 1;
  let queued = new Map<number, () => void>();
  const clock = {
    requested: 0,
    now: () => now,
    request(callback: () => void) {
      clock.requested++;
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
  return clock;
}

/** A random that gives the same numbers for the same seed (mulberry32). */
export function seededRandom(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A document whose `hidden` the spec sets, with its visibility listeners. */
export function fakeDocument(real: Document) {
  const listeners = new Set<() => void>();
  const fake = {
    hidden: false,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.delete(listener);
    },
    createElement: (name: string) => real.createElement(name),
    /** Sets `hidden` and tells the listeners. */
    setHidden(hidden: boolean) {
      fake.hidden = hidden;
      for (const listener of listeners) listener();
    },
    listeners,
  };
  return fake;
}

/** The host's dependencies for an engine spec. */
export function motionHost(host: HTMLElement, seed = 1) {
  const clock = steppedFrames();
  const document = fakeDocument(host.ownerDocument);
  const deps: MotionHost = {
    host,
    clock,
    random: seededRandom(seed),
    document: document as unknown as Document,
  };
  return { deps, clock, document };
}

/** A piece as the template renders it, for the token motions. */
export function pieceElement(
  doc: Document,
  options: { index: number; from: number; text: string; decrypt?: boolean },
): HTMLElement {
  const piece = doc.createElement('span');
  piece.className = 'piece';
  piece.dataset['token'] = String(options.index);
  piece.dataset['from'] = String(options.from);
  if (options.decrypt) {
    const real = doc.createElement('span');
    real.className = 'real';
    real.textContent = options.text;
    const noise = doc.createElement('span');
    noise.className = 'noise';
    noise.setAttribute('aria-hidden', 'true');
    piece.append(real, noise);
  } else {
    piece.textContent = options.text;
  }
  return piece;
}
