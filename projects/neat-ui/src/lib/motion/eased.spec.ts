import { createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { easedBy, neatEased } from './eased';

/** `matchMedia` answering the reduced-motion query with `reduce`. */
function stubReducedMotion(reduce: boolean) {
  const matchMedia = vi.fn((query: string) => ({ matches: reduce, media: query }));
  vi.stubGlobal('matchMedia', matchMedia);
  return matchMedia;
}

/** An eased value on a clock and frames the spec steps by hand, in an injector it can destroy. */
function setup(initial: number | null | undefined) {
  let clock = 1000;
  const frames: (() => void)[] = [];
  const cancelled: number[] = [];
  const source = signal<number | null | undefined>(initial);
  const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
  const value = injector.runInContext(() =>
    easedBy(
      {
        now: () => clock,
        request: (callback) => frames.push(callback),
        cancel: (handle) => cancelled.push(handle),
      },
      source,
    ),
  );
  TestBed.tick();
  /** Sets the source and lets its effect run. */
  const change = (next: number | null | undefined): void => {
    source.set(next);
    TestBed.tick();
  };
  /** Moves the clock and runs the frame that was asked for, if any. */
  const advance = (ms: number): void => {
    clock += ms;
    frames.splice(0).forEach((callback) => callback());
  };
  return { value, change, advance, frames, cancelled, injector };
}

describe('neatEased', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the first value at once, asking for no frame', () => {
    const { value, frames } = setup(10);

    expect(value()).toBe(10);
    expect(frames).toHaveLength(0);
  });

  it('is at 0.875 of the way after 200 ms, ease-out cubic over 400 ms', () => {
    const { value, change, advance } = setup(10);

    change(18);
    advance(200);

    // 1 - (1 - 0.5)³ = 0.875
    expect(value()).toBeCloseTo(10 + 0.875 * 8);
  });

  it('settles on the value at 400 ms and asks for no frame after that', () => {
    const { value, change, advance, frames } = setup(10);

    change(18);
    advance(300);
    expect(value()).toBeLessThan(18);
    advance(100);

    expect(value()).toBe(18);
    expect(frames).toHaveLength(0);
  });

  it('starts from where it is when the value changes on the way', () => {
    const { value, change, advance } = setup(0);

    change(100);
    advance(100);
    const partway = value() as number;
    change(0);
    advance(1);

    expect(value()).toBeLessThanOrEqual(partway);
    expect(value()).toBeGreaterThan(0);
    advance(400);
    expect(value()).toBe(0);
  });

  it('passes null and undefined through, and shows a value after none at once', () => {
    const { value, change, frames } = setup(null);

    expect(value()).toBeNull();
    change(5);
    expect(value()).toBe(5);
    change(undefined);
    expect(value()).toBeUndefined();
    change(7);
    expect(value()).toBe(7);
    change(null);
    expect(value()).toBeNull();
    expect(frames).toHaveLength(0);
  });

  it('follows the source at once under a reduced-motion setting', () => {
    const matchMedia = stubReducedMotion(true);
    const { value, change, frames } = setup(10);

    change(18);

    expect(value()).toBe(18);
    expect(frames).toHaveLength(0);
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('eases when motion is not reduced', () => {
    stubReducedMotion(false);
    const { value, change, frames } = setup(10);

    change(18);

    expect(value()).toBe(10);
    expect(frames).toHaveLength(1);
  });

  it('cancels the frame it waits for when its injector is destroyed', () => {
    const { change, frames, cancelled, injector } = setup(10);

    change(18);
    expect(frames).toHaveLength(1);
    injector.destroy();

    // The fake's handle is the frame's place in the queue, from 1.
    expect(cancelled).toEqual([1]);
  });

  it('runs on the browser’s clock and frames, for as long as it is told', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    try {
      const source = signal(10);
      const value = TestBed.runInInjectionContext(() => neatEased(source, { durationMs: 100 }));
      TestBed.tick();

      source.set(20);
      TestBed.tick();
      vi.advanceTimersByTime(50);
      expect(value()).toBeGreaterThan(10);
      expect(value()).toBeLessThan(20);
      vi.advanceTimersByTime(100);
      expect(value()).toBe(20);
    } finally {
      vi.useRealTimers();
    }
  });
});
