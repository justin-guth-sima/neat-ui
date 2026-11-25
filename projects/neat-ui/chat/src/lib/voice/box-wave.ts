import { NEAT_EASINGS, ɵFrameLoop } from '@sima/neat-ui';
import type { ListeningEngine, ListeningHost } from './listening';
import { SizedCanvas } from './sized-canvas';

/** One bar every 4 px, each 2.4 px wide, at least 2 px high. */
const STEP = 4;
const WIDTH = 2.4;
const FLOOR = 2;
/** The widest box the waveform fills (px): the ring holds a level for every bar it can show. */
const MOST_WIDTH = 4096;
const SLOTS = Math.ceil(MOST_WIDTH / STEP);
/** How long the bars take to collapse on release: the ring and waveform's collapse. */
const COLLAPSE_MS = 350;
const collapse = NEAT_EASINGS['ease-in'];

/**
 * In the message box (moments mockup, listening C): the level of each frame as a bar on a canvas
 * laid over the box's text area, the newest at the right, scrolling left. On release the bars
 * collapse to 2 px over 0.35 s and stay so, drawn, until the engine goes (the box keeps it while
 * the recording is transcribed). Internal.
 */
export class BoxWaveEngine implements ListeningEngine {
  /** The levels, a ring of slots: `count` of them written, the newest at `head - 1`. */
  private readonly levels = new Float32Array(SLOTS);
  private head = 0;
  private count = 0;
  private on = false;
  private releasedAt = Number.NEGATIVE_INFINITY;
  private color = '';
  private readonly canvas: SizedCanvas;
  private readonly frames: ɵFrameLoop;

  constructor(private readonly deps: ListeningHost) {
    this.canvas = new SizedCanvas(() =>
      deps.host.querySelector<HTMLCanvasElement>('canvas.listening'),
    );
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => this.on || deps.clock.now() < this.releasedAt + COLLAPSE_MS,
    );
  }

  recording(on: boolean): void {
    this.on = on;
    if (on) {
      this.head = 0;
      this.count = 0;
      const style = this.deps.host.ownerDocument.defaultView!.getComputedStyle(this.deps.host);
      this.color = style.getPropertyValue('--neat-series-4').trim();
    } else {
      this.releasedAt = this.deps.clock.now();
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
    if (this.on) {
      this.levels[this.head] = this.deps.level() ?? 0;
      this.head = (this.head + 1) % SLOTS;
      this.count = Math.min(SLOTS, this.count + 1);
    }
    const left = this.on
      ? 1
      : 1 - collapse(Math.min(1, (this.deps.clock.now() - this.releasedAt) / COLLAPSE_MS));
    this.draw(left);
  }

  /** The newest bars from the right; `left` is how much of their height the collapse leaves. */
  private draw(left: number): void {
    const context = this.canvas.draw();
    if (!context) return;
    const { width, height } = this.canvas;
    context.clearRect(0, 0, width, height);
    context.fillStyle = this.color;
    const shown = Math.min(this.count, Math.floor(width / STEP));
    for (let k = shown; k >= 1; k--) {
      const value = this.levels[(this.head - k + SLOTS) % SLOTS];
      const bar = FLOOR + value * (height - 4) * left;
      context.fillRect(width - k * STEP, (height - bar) / 2, WIDTH, bar);
    }
  }
}
