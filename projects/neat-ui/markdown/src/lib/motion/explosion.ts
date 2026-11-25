import { ɵFrameLoop as FrameLoop } from '@sima/neat-ui';
import type { MotionEngine, MotionHost } from './engine';

/** How many particles live at once; the oldest is overwritten. */
const CAPACITY = 4096;
/** At most this many particles per line of a piece, and this many per pixel of its width. */
const MOST_PER_RECT = 60;
const PER_PIXEL = 1.3;
/** Where a particle starts: this far from its end, at a random angle (px). */
const START_NEAR = 40;
const START_SPREAD = 70;
/** When a particle starts (ms after the piece), how long it condenses, how long it fades. */
const JITTER_MS = 60;
const CONDENSE_MS = 300;
const CONDENSE_SPREAD_MS = 160;
const FADE_MS = 220;
/** A particle's alpha as it starts. */
const START_ALPHA = 0.35;
/** A particle is a square of this size (px). */
const SIZE = 2;
/** The band the particles are drawn in: as wide as the host, this high, on the newest line. */
const BAND_HEIGHT = 400;
/** The theme's colors a particle takes one of. */
const COLOR_TOKENS = [
  '--neat-series-1',
  '--neat-series-2',
  '--primary',
  '--neat-series-4',
  '--foreground',
];

/**
 * The reverse explosion motion: particles condense from around each new piece into its place,
 * drawn on a canvas band over the newest line (a canvas over a whole long reply would take
 * hundreds of MB of backing store). Particles are kept in host coordinates in fixed typed arrays,
 * so a frame allocates nothing. Internal.
 */
export class ExplosionEngine implements MotionEngine {
  private readonly startX = new Float32Array(CAPACITY);
  private readonly startY = new Float32Array(CAPACITY);
  private readonly endX = new Float32Array(CAPACITY);
  private readonly endY = new Float32Array(CAPACITY);
  private readonly startAt = new Float64Array(CAPACITY);
  private readonly duration = new Float32Array(CAPACITY);
  private readonly color = new Uint8Array(CAPACITY);
  /** The color strings particles point into, each kept once. */
  private readonly palette: string[] = [];
  /** Where the next particle goes, and how many slots hold one. */
  private next = 0;
  private used = 0;
  /** When the last particle stops showing. */
  private lastEnd = Number.NEGATIVE_INFINITY;
  /** The highest piece index seen, and the pieces' epoch it counts in. */
  private newest = -1;
  private epoch: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private bandTop = 0;
  private readonly resizes: ResizeObserver | null;
  private readonly frames: FrameLoop;

  constructor(private readonly deps: MotionHost) {
    this.frames = new FrameLoop(
      deps,
      () => this.draw(),
      () => this.deps.clock.now() < this.lastEnd,
    );
    this.resizes =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(([entry]) => this.size(entry.contentRect))
        : null;
  }

  moving(): boolean {
    return this.frames.active;
  }

  rendered(_streaming: boolean, epoch: number): void {
    const canvas = this.deps.host.querySelector<HTMLCanvasElement>('canvas.particles');
    if (canvas !== this.canvas) {
      if (this.canvas) this.resizes?.unobserve(this.canvas);
      this.canvas = canvas;
      this.context = canvas?.getContext('2d') ?? null;
      if (canvas) this.resizes?.observe(canvas);
    }
    const pieces = this.deps.host.querySelectorAll<HTMLElement>('span.piece');
    let newest = -1;
    for (const piece of pieces) newest = Math.max(newest, Number(piece.dataset['token']));
    if (epoch !== this.epoch) this.restart(epoch);
    const fresh = this.frames.fresh();
    const hostBox = this.deps.host.getBoundingClientRect();
    let line: DOMRect | null = null;
    for (const piece of pieces) {
      if (Number(piece.dataset['token']) <= this.newest) continue;
      const rects = piece.getClientRects();
      if (rects.length > 0) line = rects[rects.length - 1];
      if (fresh) this.spawn(rects, hostBox);
    }
    this.newest = Math.max(this.newest, newest);
    if (line) this.place(line, hostBox);
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
    this.resizes?.disconnect();
    this.context?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
  }

  /** The pieces start again (a text written anew): every particle goes, the count from 0. */
  private restart(epoch: number): void {
    if (this.epoch !== null) {
      this.next = 0;
      this.used = 0;
      this.lastEnd = Number.NEGATIVE_INFINITY;
      this.context?.clearRect(0, 0, this.canvas?.width ?? 0, this.canvas?.height ?? 0);
    }
    this.epoch = epoch;
    this.newest = -1;
  }

  /** Particles for each line of a new piece, in the theme's colors as they are now. */
  private spawn(rects: DOMRectList, hostBox: DOMRect): void {
    const { random, clock, host } = this.deps;
    const style = getComputedStyle(host);
    const colors = COLOR_TOKENS.map((token) => this.colorIndex(style.getPropertyValue(token)));
    const now = clock.now();
    for (const rect of rects) {
      const count = Math.min(MOST_PER_RECT, Math.round(rect.width * PER_PIXEL));
      for (let i = 0; i < count; i++) {
        const slot = this.next;
        this.next = (this.next + 1) % CAPACITY;
        this.used = Math.min(CAPACITY, this.used + 1);
        const x = rect.left - hostBox.left + random() * rect.width;
        const y = rect.top - hostBox.top + rect.height * (0.25 + random() * 0.6);
        const angle = random() * 2 * Math.PI;
        const distance = START_NEAR + random() * START_SPREAD;
        this.endX[slot] = x;
        this.endY[slot] = y;
        this.startX[slot] = x + Math.cos(angle) * distance;
        this.startY[slot] = y + Math.sin(angle) * distance;
        this.startAt[slot] = now + random() * JITTER_MS;
        this.duration[slot] = CONDENSE_MS + random() * CONDENSE_SPREAD_MS;
        this.color[slot] = colors[Math.floor(random() * colors.length)];
        this.lastEnd = Math.max(this.lastEnd, this.startAt[slot] + this.duration[slot] + FADE_MS);
      }
    }
  }

  private colorIndex(color: string): number {
    const value = color.trim();
    let index = this.palette.indexOf(value);
    if (index < 0) index = this.palette.push(value) - 1;
    return index;
  }

  /** Moves the band onto the line's middle, inside the host. */
  private place(line: DOMRect, hostBox: DOMRect): void {
    const band = Math.min(BAND_HEIGHT, hostBox.height);
    const middle = line.top - hostBox.top + line.height / 2;
    this.bandTop = Math.max(0, Math.min(middle - BAND_HEIGHT / 2, hostBox.height - band));
    if (this.canvas) this.canvas.style.transform = `translateY(${this.bandTop}px)`;
  }

  /** The backing store at the device pixel ratio. */
  private size(box: DOMRectReadOnly): void {
    if (!this.canvas) return;
    const ratio = devicePixelRatio;
    this.canvas.width = Math.round(box.width * ratio);
    this.canvas.height = Math.round(box.height * ratio);
  }

  private draw(): void {
    const context = this.context;
    if (!context || !this.canvas) return;
    const ratio = devicePixelRatio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const now = this.deps.clock.now();
    for (let slot = 0; slot < this.used; slot++) {
      const age = now - this.startAt[slot];
      const duration = this.duration[slot];
      if (age >= duration + FADE_MS) continue;
      const progress = Math.max(0, Math.min(1, age / duration));
      const eased = 1 - (1 - progress) ** 3;
      const x = this.startX[slot] + (this.endX[slot] - this.startX[slot]) * eased;
      const y = this.startY[slot] + (this.endY[slot] - this.startY[slot]) * eased;
      context.globalAlpha =
        progress < 1
          ? START_ALPHA + (1 - START_ALPHA) * progress
          : Math.max(0, 1 - (age - duration) / FADE_MS);
      context.fillStyle = this.palette[this.color[slot]];
      context.fillRect(x - SIZE / 2, y - SIZE / 2 - this.bandTop, SIZE, SIZE);
    }
    context.globalAlpha = 1;
  }
}
