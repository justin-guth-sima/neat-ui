/*
 * jsdom has no 2D context, so the bird's-eye view's specs stand one in that records what is done
 * to it: every method called (with its arguments) and every property set, in order.
 */

/** One thing done to a context: a call or a property set. */
export interface Recorded {
  readonly name: string;
  readonly args: readonly unknown[];
  /** For a property set: what it was set to. */
  readonly value?: unknown;
}

/** A recording context and what it saw. */
export interface Recording {
  readonly context: CanvasRenderingContext2D;
  readonly log: Recorded[];
}

/** The calls named `name`, in order. */
export function calls(log: readonly Recorded[], name: string): Recorded[] {
  return log.filter((entry) => entry.name === name && !('value' in entry));
}

/** The values the property `name` was set to, in order. */
export function sets(log: readonly Recorded[], name: string): unknown[] {
  return log.filter((entry) => entry.name === name && 'value' in entry).map((e) => e.value);
}

/** A context that records everything and draws nothing. */
export function recordingContext(): Recording {
  const log: Recorded[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1 };
  const context = new Proxy(state, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createImageData') {
        return (width: number, height: number) => ({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        });
      }
      if (name === 'measureText') return (text: string) => ({ width: text.length * 6 });
      return (...args: unknown[]) => {
        log.push({ name: String(name), args });
      };
    },
    set(target, name, value) {
      target[name] = value;
      log.push({ name: String(name), args: [], value });
      return true;
    },
  });
  return { context: context as unknown as CanvasRenderingContext2D, log };
}

/** Every canvas gets a recording context of its own; answers each canvas's recording. */
export function stubCanvases(): (canvas: HTMLCanvasElement) => Recording {
  const recordings = new WeakMap<HTMLCanvasElement, Recording>();
  const of = (canvas: HTMLCanvasElement): Recording => {
    let recording = recordings.get(canvas);
    if (!recording) recordings.set(canvas, (recording = recordingContext()));
    return recording;
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return of(this).context;
  } as unknown as HTMLCanvasElement['getContext']);
  return of;
}

/** requestAnimationFrame under the test's control: a frame runs only when the test says so. */
export class FakeAnimationFrames {
  readonly callbacks = new Map<number, FrameRequestCallback>();
  private nextId = 1;

  install(): void {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      this.callbacks.delete(id);
    });
  }

  /** Runs one frame at `now`: every pending callback once, as the browser does. */
  run(now = 0): void {
    const pending = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of pending) callback(now);
  }
}

/** The ResizeObservers made since `stubResizeObserver`, and what each watches. */
const observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  readonly watched = new Set<Element>();

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this);
  }

  observe(target: Element): void {
    this.watched.add(target);
  }

  unobserve(target: Element): void {
    this.watched.delete(target);
  }

  disconnect(): void {
    this.watched.clear();
  }
}

/** Puts a hand-driven stand-in in place of `ResizeObserver` (undone by `vi.unstubAllGlobals`). */
export function stubResizeObserver(): void {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
}

/** Reports `element`'s border box to the observers watching it, as a browser would after layout. */
export function resize(element: Element, width: number, height: number): void {
  for (const observer of observers) {
    if (!observer.watched.has(element)) continue;
    const entry = {
      target: element,
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
    } as unknown as ResizeObserverEntry;
    observer.callback([entry], observer as unknown as ResizeObserver);
  }
}
