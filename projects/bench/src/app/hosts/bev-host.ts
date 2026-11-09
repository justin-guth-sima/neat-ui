import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { type NeatBevFrame, NeatBev } from '@sima/neat-ui/bev';
import { CallbackTimer } from '../measure/callback-timer';
import { calibrateRefresh, FrameRecorder } from '../measure/frame-recorder';
import { type FrameStats, frameStats, percentile } from '../measure/stats';
import { ActivatedRoute } from '@angular/router';
import { BEV_LOAD, BevLoad, type BevLoadSize } from '../synth/bev-load';

/** What the page says when it gets too few frames to measure by. */
export const NO_FRAMES =
  'Too few frames came to measure by: a hidden tab, or a browser without a display.';

/** How long the page settles (and calibrates the refresh) before it measures, and measures. */
export const BEV_WARMUP_MS = 2000;
export const BEV_MEASURE_MS = 10_000;

/** What the bird's-eye view's measurement found, as the page shows it and `benchBev` holds it. */
export interface BevBenchResult {
  readonly hz: number;
  /** The frames the page showed while the view drew the load. */
  readonly frames: FrameStats;
  /** Each frame's script in its animation-frame callbacks (the view's draw and what it starts), ms. */
  readonly script: { readonly p50: number; readonly p95: number; readonly worst: number };
}

declare global {
  interface Window {
    /** The bird's-eye view's measurement once it is done (`page.waitForFunction` waits for it). */
    benchBev?: BevBenchResult;
  }
}

/**
 * The bird's-eye view's measured page (its budget, `BEV_LOAD`): `neat-bev` filling the
 * window, fed 100 moving objects, 30,000 lidar returns, 4 lines and a 128 × 128 grid at 20 Hz.
 * After a warm-up that calibrates the refresh it measures for ten seconds: the frames shown (the
 * bench's frame recorder and statistics) and each frame's script time in its animation-frame
 * callbacks, timed from outside through `requestAnimationFrame`, so nothing of the kit's is
 * reached into. The result shows on the page and as `window.benchBev` for the harness.
 * `?objects=` and `?points=` change the load's size, to find which part of it a cost comes from.
 */
@Component({
  selector: 'bench-bev-host',
  imports: [NeatBev],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./host.css', './bev-host.css'],
  template: `
    <neat-bev class="view" [frame]="frame()" [range]="range" />
    <output class="bev-result">{{ result() }}</output>
  `,
})
export class BevHost {
  protected readonly range = BEV_LOAD.range;
  private readonly load = new BevLoad(1, loadSize(inject(ActivatedRoute).snapshot.queryParamMap));
  protected readonly frame = signal<NeatBevFrame>(this.load.frameAt(0));
  protected readonly result = signal('Measuring…');

  constructor() {
    const recorder = new FrameRecorder({ capacity: 4096 });
    const timer = new CallbackTimer(window);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let feed: ReturnType<typeof setInterval> | undefined;
    afterNextRender(() => {
      const started = performance.now();
      feed = setInterval(
        () => this.frame.set(this.load.frameAt((performance.now() - started) / 1000)),
        1000 / BEV_LOAD.hz,
      );
      timer.install();
      recorder.start();
      let from = 0;
      let refresh: ReturnType<typeof calibrateRefresh> | null = null;
      timers.push(
        setTimeout(() => {
          try {
            refresh = calibrateRefresh(recorder.between(0, recorder.mark()));
          } catch {
            // No frames, or too few to calibrate on: a hidden tab, or a browser without a display.
            this.result.set(NO_FRAMES);
            return;
          }
          from = recorder.mark();
          timer.reset();
        }, BEV_WARMUP_MS),
        setTimeout(() => {
          const to = refresh ? recorder.mark() : 0;
          recorder.stop();
          timer.uninstall();
          clearInterval(feed);
          if (!refresh) return;
          const phase = recorder.between(from, to);
          const script = Float64Array.from(timer.results()).sort();
          const result: BevBenchResult = {
            hz: refresh.hz,
            frames: frameStats(phase.deltas, phase.windowMs, refresh.intervalMs),
            script: script.length
              ? {
                  p50: percentile(script, 50),
                  p95: percentile(script, 95),
                  worst: script[script.length - 1],
                }
              : { p50: 0, p95: 0, worst: 0 },
          };
          window.benchBev = result;
          this.result.set(describe(result));
        }, BEV_WARMUP_MS + BEV_MEASURE_MS),
      );
    });
    inject(DestroyRef).onDestroy(() => {
      timers.forEach(clearTimeout);
      clearInterval(feed);
      recorder.stop();
      timer.uninstall();
    });
  }
}

/** The load's size from the page's query (`objects`, `points`), the budget's where it says none. */
export function loadSize(query: { get(name: string): string | null }): BevLoadSize {
  const count = (name: keyof BevLoadSize): number => {
    const value = Number(query.get(name) ?? Number.NaN);
    return Number.isInteger(value) && value >= 0 ? value : BEV_LOAD[name];
  };
  return { objects: count('objects'), points: count('points') };
}

/** The result in a line: the frames shown and the script each frame ran. */
export function describe({ hz, frames, script }: BevBenchResult): string {
  const ms = (value: number) => value.toFixed(1);
  return (
    `${frames.fps.toFixed(1)} fps at ${hz} Hz, frame p95 ${ms(frames.p95)} ms, ` +
    `${frames.dropped} dropped, script p50 ${ms(script.p50)} / p95 ${ms(script.p95)} / ` +
    `worst ${ms(script.worst)} ms`
  );
}
