import { ɵFrameLoop } from '@sima/neat-ui';
import type { ListeningEngine, ListeningHost } from './listening';

/** The waveform's bars, and how often a level enters it (ms). */
export const WAVE_BARS = 28;
const SAMPLE_MS = 50;
/** What the history starts with, before the voice: the mockup's quiet. */
const QUIET = 0.05;
/** A bar's lowest and highest height (px) in the 53 px of a full bar: 3 + level × 50. */
const BAR_FLOOR = 3;
const BAR_RANGE = 50;
const BAR_FULL = BAR_FLOOR + BAR_RANGE;
/** How far the ring swells at full level, and how long the bars take to collapse (their CSS). */
const RING_SWELL = 0.45;
const COLLAPSE_MS = 350;

/**
 * Ring and waveform (moments mockup, listening A): a ring round the button that swells with the
 * level and fades as it grows, and 28 bars of the last levels, one every 50 ms, scrolling left.
 * On release the bars collapse (CSS, `data-collapsed`) and the ring rests. Internal.
 */
export class RingWaveEngine implements ListeningEngine {
  private readonly history = new Float32Array(WAVE_BARS).fill(QUIET);
  private on = false;
  private nextSample = 0;
  private collapsedAt = Number.NEGATIVE_INFINITY;
  private ring: HTMLElement | null = null;
  private wave: HTMLElement | null = null;
  private bars: HTMLElement[] = [];
  private readonly frames: ɵFrameLoop;

  constructor(private readonly deps: ListeningHost) {
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => this.on || deps.clock.now() < this.collapsedAt + COLLAPSE_MS,
    );
  }

  recording(on: boolean): void {
    this.on = on;
    this.find();
    if (on) {
      this.history.fill(QUIET);
      this.nextSample = this.deps.clock.now();
      this.wave?.removeAttribute('data-collapsed');
    } else {
      this.collapsedAt = this.deps.clock.now();
      this.rest();
    }
    this.frames.start();
  }

  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
  }

  private frame(): void {
    if (!this.on) return;
    this.find();
    const now = this.deps.clock.now();
    const level = this.deps.level() ?? 0;
    if (now >= this.nextSample) {
      this.history.copyWithin(0, 1);
      this.history[WAVE_BARS - 1] = level;
      // One level per frame at most: back in view the bars show the level now, with no catch-up.
      this.nextSample =
        now >= this.nextSample + SAMPLE_MS ? now + SAMPLE_MS : this.nextSample + SAMPLE_MS;
    }
    const scale = 1 + level * RING_SWELL;
    if (this.ring) {
      this.ring.style.transform = `scale(${round(scale)})`;
      this.ring.style.opacity = String(round(1.6 - scale));
    }
    for (let i = 0; i < this.bars.length; i++) {
      this.bars[i].style.transform =
        `scaleY(${round((BAR_FLOOR + this.history[i] * BAR_RANGE) / BAR_FULL)})`;
    }
  }

  /** Released: the ring at rest, the bars collapsing by their CSS. */
  private rest(): void {
    if (this.ring) {
      this.ring.style.transform = 'scale(1)';
      this.ring.style.opacity = '0.6';
    }
    this.wave?.setAttribute('data-collapsed', '');
    for (const bar of this.bars) bar.style.transform = '';
  }

  /** The ring and the bars, once the template has rendered them. */
  private find(): void {
    if (this.wave?.isConnected) return;
    const host = this.deps.host;
    this.ring = host.querySelector<HTMLElement>('.ring');
    this.wave = host.querySelector<HTMLElement>('.wave');
    this.bars = this.wave ? [...this.wave.querySelectorAll<HTMLElement>('i')] : [];
  }
}

/** A number short enough for a style, without float noise. */
function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}
