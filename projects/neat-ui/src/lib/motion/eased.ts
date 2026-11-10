import {
  DestroyRef,
  effect,
  inject,
  isSignal,
  type Signal,
  signal,
  untracked,
} from '@angular/core';
import { NEAT_EASINGS, type NeatEasing } from './easing';

/** How long a value takes to reach a new one, unless the caller says otherwise. */
const EASE_MS = 400;

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * The clock and the frames an eased value moves by: the browser's in the kit, a spec's that it
 * steps by hand in a test, so easing is checked frame by frame without real time. Internal.
 */
export interface FrameClock {
  now(): number;
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** The browser's clock and frames; the label timeline's smooth mode runs on them too. Internal. */
export const BROWSER_CLOCK: FrameClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

const isNone = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined;

/**
 * Read when a value changes, so a setting changed while the page is open applies to the next.
 * Shared with the label timeline's smooth mode. Internal.
 */
export function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches;
}

/**
 * A number signal that eases to each new value of `source` instead of jumping.
 *
 * ```ts
 * readonly shownFps = neatEased(this.fps);
 * ```
 *
 * A figure that updates twice a second then reads as moving rather than flickering. Call it in an
 * injection context.
 *
 * It takes 400 ms, or `durationMs`. The curve is `easing`, `'ease-in-out'` unless told otherwise.
 * Take a catalog name first, so apps share one way of moving, and a function only where no name
 * fits. A signal of either may switch the curve while a value is moving, and the next frame
 * follows the new one.
 *
 * A curve that overshoots shows more than the target on the way. The last frame shows the target
 * exactly.
 *
 * The first value, and a value that follows none (null or undefined), appears at once. Null and
 * undefined pass through as they are. Under a reduced-motion setting it follows `source` at once.
 *
 * Frames are asked for only while it moves, and canceled when its injector is destroyed.
 */
export function neatEased(
  source: Signal<number | null | undefined>,
  options: { durationMs?: number; easing?: NeatEasing | Signal<NeatEasing> } = {},
): Signal<number | null | undefined> {
  return easedBy(BROWSER_CLOCK, source, options);
}

/** `neatEased` on the given clock. Internal: specs drive it with a clock of their own. */
export function easedBy(
  clock: FrameClock,
  source: Signal<number | null | undefined>,
  {
    durationMs = EASE_MS,
    easing = 'ease-in-out',
  }: { durationMs?: number; easing?: NeatEasing | Signal<NeatEasing> } = {},
): Signal<number | null | undefined> {
  const shown = signal<number | null | undefined>(undefined);
  let from = 0;
  let to: number | null | undefined;
  let start = 0;
  let handle: number | undefined;

  const stop = (): void => {
    if (handle !== undefined) clock.cancel(handle);
    handle = undefined;
  };

  // Resolved every frame, so a curve switched mid-move applies to the next frame.
  const curve = (): ((t: number) => number) => {
    const current = isSignal(easing) ? untracked(easing) : easing;
    return typeof current === 'function' ? current : NEAT_EASINGS[current];
  };

  // One signal write per frame, for 400 ms after a change: only what reads the value updates.
  const tick = (): void => {
    handle = undefined;
    if (isNone(to)) return;
    const t = Math.min(1, (clock.now() - start) / durationMs);
    shown.set(t >= 1 ? to : from + (to - from) * curve()(t));
    if (t < 1) handle = clock.request(tick);
  };

  const retarget = (value: number | null | undefined): void => {
    if (value === to) return;
    const current = shown();
    to = value;
    if (isNone(value) || isNone(current) || reducedMotion()) {
      stop();
      shown.set(value);
      return;
    }
    from = current;
    start = clock.now();
    handle ??= clock.request(tick);
  };

  effect(() => {
    const value = source();
    untracked(() => retarget(value));
  });
  inject(DestroyRef).onDestroy(stop);
  return shown.asReadonly();
}
