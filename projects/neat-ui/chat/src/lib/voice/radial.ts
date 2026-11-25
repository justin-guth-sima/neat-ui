import { ɵFrameLoop } from '@sima/neat-ui';
import type { ListeningEngine, ListeningHost } from './listening';
import { SizedCanvas } from './sized-canvas';

/** The bars round the button. */
const BARS = 56;
/** The canvas's size against the button's, and the bars' start and reach against its radius. */
export const RADIAL_SIZE = 150 / 58;
const INNER = 33 / 29;
const REACH = 34 / 29;
/** The bars' shortest length (px), width (px) and how long they take to fold in on release. */
const STUB = 3;
const WIDTH = 2.4;
const FOLD_MS = 350;
/** How much of the bar's last length stays each frame, and how fast its ripple runs (rad/s). */
const KEEP = 0.55;
const RIPPLE = 9;

/**
 * Radial (moments mockup, listening B): 56 bars round the button on a canvas, each smoothed toward
 * the level times its own ripple, in two series colors; on release they fold in over 350 ms, then
 * the frames stop. Internal.
 */
export class RadialEngine implements ListeningEngine {
  private readonly values = new Float32Array(BARS);
  private on = false;
  private startedAt = 0;
  private releasedAt = Number.NEGATIVE_INFINITY;
  private fold = 1;
  private odd = '';
  private even = '';
  private readonly canvas: SizedCanvas;
  private readonly frames: ɵFrameLoop;

  constructor(private readonly deps: ListeningHost) {
    this.canvas = new SizedCanvas(() =>
      deps.host.querySelector<HTMLCanvasElement>('canvas.radial'),
    );
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => this.on || this.fold > 0,
    );
  }

  recording(on: boolean): void {
    this.on = on;
    const now = this.deps.clock.now();
    if (on) {
      this.values.fill(0);
      this.fold = 1;
      this.startedAt = now;
      // The colors as the theme has them now, once per recording.
      const style = this.deps.host.ownerDocument.defaultView!.getComputedStyle(this.deps.host);
      this.odd = style.getPropertyValue('--neat-series-4').trim();
      this.even = style.getPropertyValue('--neat-series-1').trim();
    } else {
      this.releasedAt = now;
    }
    this.frames.start();
  }

  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
    this.canvas.destroy();
  }

  private frame(): void {
    const now = this.deps.clock.now();
    if (this.on) {
      const level = this.deps.level() ?? 0;
      const t = (now - this.startedAt) / 1000;
      for (let i = 0; i < BARS; i++) {
        const ripple = 0.5 + 0.5 * Math.abs(Math.sin(i * 1.7 + t * RIPPLE));
        this.values[i] = this.values[i] * KEEP + (1 - KEEP) * level * ripple;
      }
    } else {
      this.fold = Math.max(0, 1 - (now - this.releasedAt) / FOLD_MS);
    }
    this.draw();
  }

  private draw(): void {
    const context = this.canvas.draw();
    if (!context) return;
    const { width, height } = this.canvas;
    context.clearRect(0, 0, width, height);
    const radius = width / RADIAL_SIZE / 2;
    const inner = INNER * radius;
    const reach = REACH * radius * this.fold;
    context.translate(width / 2, height / 2);
    context.lineWidth = WIDTH;
    context.lineCap = 'round';
    // One path per color: the even bars, then the odd ones.
    for (const parity of [0, 1]) {
      context.strokeStyle = parity ? this.odd : this.even;
      context.beginPath();
      for (let i = parity; i < BARS; i += 2) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const outer = inner + STUB + this.values[i] * reach;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        context.moveTo(x * inner, y * inner);
        context.lineTo(x * outer, y * outer);
      }
      context.stroke();
    }
  }
}
