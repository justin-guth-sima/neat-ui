import { afterEach, describe, expect, it, vi } from 'vitest';
import { boxOf, recordingContext } from './listening.testing';
import { SizedCanvas } from './sized-canvas';

describe('SizedCanvas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('gives no context until the canvas is there, then sizes it at the pixel ratio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    let canvas: HTMLCanvasElement | null = null;
    const sized = new SizedCanvas(() => canvas);
    expect(sized.draw()).toBeNull();
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    boxOf(canvas, 120, 30);
    const context = recordingContext(canvas);
    expect(sized.draw()).not.toBeNull();
    expect([canvas.width, canvas.height, sized.width, sized.height]).toEqual([240, 60, 120, 30]);
    expect(context.named('setTransform')[0].args).toEqual([2, 0, 0, 2, 0, 0]);
    sized.destroy();
    canvas.remove();
  });

  it('follows its size with a ResizeObserver and stops when destroyed', () => {
    const observers: { callback: ResizeObserverCallback; disconnected: boolean }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly entry = {
          callback: null as unknown as ResizeObserverCallback,
          disconnected: false,
        };
        constructor(callback: ResizeObserverCallback) {
          this.entry.callback = callback;
          observers.push(this.entry);
        }
        observe = () => undefined;
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    boxOf(canvas, 100, 20);
    recordingContext(canvas);
    const sized = new SizedCanvas(() => canvas);
    sized.draw();
    observers[0].callback(
      [{ contentRect: { width: 50, height: 10 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    expect(sized.width).toBe(50);
    expect(canvas.width).toBe(Math.round(50 * devicePixelRatio));
    sized.destroy();
    expect(observers[0].disconnected).toBe(true);
    canvas.remove();
  });

  it('finds a canvas rendered anew', () => {
    let canvas = document.createElement('canvas');
    document.body.append(canvas);
    boxOf(canvas, 10, 10);
    const first = recordingContext(canvas);
    const sized = new SizedCanvas(() => canvas);
    sized.draw();
    canvas.remove();
    canvas = document.createElement('canvas');
    document.body.append(canvas);
    boxOf(canvas, 20, 10);
    const second = recordingContext(canvas);
    first.clear();
    sized.draw();
    expect(first.calls).toEqual([]);
    expect(second.named('setTransform')).toHaveLength(1);
    expect(sized.width).toBe(20);
    sized.destroy();
    canvas.remove();
  });
});
