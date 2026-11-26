/** How fast the steady comet's head runs along the box's edge, in CSS pixels a second. */
export const STEADY_PX_PER_S = 600;
/** The edge's length in path units (each rect's `pathLength`), which the dashes are measured in. */
export const COMET_PATH = 1000;
/** How much of the edge the tail covers, from its faint end to the head. */
export const COMET_TAIL = 0.36;
/** How many dashes the tail is drawn in, each one color. */
const SEGMENTS = 24;
/** How far a dash reaches into the next, in path units, so no seam shows between them. */
const OVERLAP = 0.6;

/** One dash of the comet's tail: its pattern along the edge and its color. Internal. */
export interface CometSegment {
  readonly dasharray: string;
  readonly stroke: string;
}

/**
 * The comet's tail as dashes along the edge, from its faint end to the head: the comet's colors
 * (`--neat-series-2` fading in, `--primary`, then `--neat-glow-head`) at the places the comet's
 * gradient has them, but measured along the edge, so the tail keeps one length in pixels all the
 * way round. Each pattern is "0 <before> <dash> <after>", so one offset runs every dash. Internal.
 */
export const COMET_SEGMENTS: readonly CometSegment[] = Array.from({ length: SEGMENTS }, (_, i) => {
  const step = (COMET_TAIL * COMET_PATH) / SEGMENTS;
  const before = i * step;
  const dash = i === SEGMENTS - 1 ? step : step + OVERLAP;
  return {
    dasharray: `0 ${before} ${dash} ${COMET_PATH - before - dash}`,
    stroke: colorAt((i + 0.5) / SEGMENTS),
  };
});

/**
 * The comet's color a share `f` along its tail, from its end (0) to its head (1): the stops of the
 * comet's conic gradient (series 2 at 75 %, the primary at 92 %, the head at 99 % of a turn whose
 * tail starts at 55 %), as shares of the tail.
 */
function colorAt(f: number): string {
  const percent = (x: number) => `${Math.round(Math.min(1, Math.max(0, x)) * 100)}%`;
  const series = 20 / 45;
  const primary = 37 / 45;
  const head = 44 / 45;
  if (f < series) {
    return `color-mix(in oklab, var(--neat-series-2) ${percent(f / series)}, transparent)`;
  }
  if (f < primary) {
    const share = (f - series) / (primary - series);
    return `color-mix(in oklab, var(--primary) ${percent(share)}, var(--neat-series-2))`;
  }
  const share = (f - primary) / (head - primary);
  return `color-mix(in oklab, var(--neat-glow-head) ${percent(share)}, var(--primary))`;
}

/**
 * How long the comet's lap of a `width` × `height` box with corners of `radius` takes at
 * `STEADY_PX_PER_S`: the length of its stroke's middle, 1 px in, its rounded corners cut; 0 for a
 * box with no size. Internal.
 */
export function cometLapMs(width: number, height: number, radius: number): number {
  const w = width - 2;
  const h = height - 2;
  if (!(w > 0 && h > 0)) return 0;
  const r = Math.min(Math.max(0, radius - 1), w / 2, h / 2);
  const round = 2 * (w + h) - (8 - 2 * Math.PI) * r;
  return (round / STEADY_PX_PER_S) * 1000;
}

/**
 * The steady comet's motion: its layer's rects (the sharp edge and the blurred halo, each the tail's
 * dashes) sized to the box's edge, and one dash offset, which the rects inherit, run round the edge
 * by the Web Animations API in a linear lap, so the head and the whole tail move at one speed in
 * pixels. It runs while the board works and pauses otherwise, so the comet fades out where it
 * stands; a new size sizes the rects again and keeps its place along the edge (or starts it, for a
 * box that had no size when it was asked to run). Without the API
 * (jsdom) it stands still, sized. Internal.
 */
export class SteadyComet {
  private lap: Animation | null = null;
  private lapMs = 0;
  /** Whether it was asked to run: a box that gets its size later starts it then. */
  private on = false;

  constructor(private readonly layer: HTMLElement) {
    this.lapMs = this.size();
  }

  /** The board works (true) or not: the comet runs or pauses. */
  running(on: boolean): void {
    this.on = on;
    if (on && !this.lap) this.start();
    if (on) this.lap?.play();
    else this.lap?.pause();
  }

  /** The box has another size: the rects follow, and the lap keeps its share. */
  resized(): void {
    const lapMs = this.size();
    if (this.lap && lapMs > 0) {
      const time = Number(this.lap.currentTime ?? 0);
      const share = this.lapMs > 0 ? (time % this.lapMs) / this.lapMs : 0;
      this.lap.effect?.updateTiming({ duration: lapMs });
      this.lap.currentTime = share * lapMs;
    }
    this.lapMs = lapMs;
    if (this.on && !this.lap) this.start();
  }

  destroy(): void {
    this.lap?.cancel();
    this.lap = null;
  }

  private start(): void {
    if (typeof this.layer.animate !== 'function' || this.lapMs <= 0) return;
    this.lap = this.layer.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -COMET_PATH }], {
      duration: this.lapMs,
      iterations: Infinity,
      easing: 'linear',
    });
  }

  /** Sizes the rects to the box's edge and gives the lap's length. */
  private size(): number {
    const { width, height } = this.layer.getBoundingClientRect();
    const view = this.layer.ownerDocument.defaultView;
    const radius = parseFloat(view?.getComputedStyle(this.layer).borderTopLeftRadius ?? '') || 0;
    const attributes = {
      x: '1',
      y: '1',
      width: `${Math.max(0, width - 2)}`,
      height: `${Math.max(0, height - 2)}`,
      rx: `${Math.max(0, radius - 1)}`,
    };
    for (const rect of this.layer.querySelectorAll('rect')) {
      for (const [name, value] of Object.entries(attributes)) rect.setAttribute(name, value);
    }
    return cometLapMs(width, height, radius);
  }
}
