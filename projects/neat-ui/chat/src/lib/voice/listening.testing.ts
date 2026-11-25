import { steppedFrames } from '../chat.testing';
import type { ListeningHost } from './listening';

/*
 * What the listening engines' specs share: a host they build by hand, a clock they step, a
 * document whose visibility they set, a level they script, and a 2D context that records its
 * calls. Internal, for specs only.
 */

/** A document whose `hidden` the spec sets, with its visibility listeners. */
export function visibleDocument(real: Document) {
  const listeners = new Set<() => void>();
  const fake = {
    hidden: false,
    defaultView: real.defaultView,
    addEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      if (type === 'visibilitychange') listeners.delete(listener);
    },
    setHidden(hidden: boolean) {
      fake.hidden = hidden;
      for (const listener of listeners) listener();
    },
    listeners,
  };
  return fake;
}

/** The engine's host deps, with a level the spec sets and a count of `stopped`. */
export function listeningHost(host: HTMLElement) {
  const clock = steppedFrames();
  const document = visibleDocument(host.ownerDocument);
  let level: number | null = 0;
  let stops = 0;
  const deps: ListeningHost = {
    host,
    clock,
    document: document as unknown as Document,
    level: () => level,
    stopped: () => stops++,
  };
  return {
    deps,
    clock,
    document,
    setLevel: (value: number | null) => (level = value),
    stops: () => stops,
  };
}

/** One call a recording context saw: its name, and its arguments or the value set. */
export interface ContextCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

/** A 2D context that records every call and property set, for a canvas the spec gives it to. */
export function recordingContext(canvas: HTMLCanvasElement) {
  const calls: ContextCall[] = [];
  const context = new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'canvas') return canvas;
        return (...args: unknown[]) => calls.push({ name, args });
      },
      set: (_target, name: string, value: unknown) => {
        calls.push({ name: `=${name}`, args: [value] });
        return true;
      },
    },
  );
  canvas.getContext = (() => context) as unknown as HTMLCanvasElement['getContext'];
  return {
    calls,
    /** The calls of that name since the last `clear()`. */
    named: (name: string) => calls.filter((call) => call.name === name),
    clear: () => (calls.length = 0),
  };
}

/** Gives an element the box `getBoundingClientRect` reports. */
export function boxOf(element: Element, width: number, height: number): void {
  element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height }) as DOMRect;
}
