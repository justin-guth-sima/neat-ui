/** How fast the steady comet's head runs along the box's edge, in CSS pixels a second. */
export const STEADY_PX_PER_S = 600;
/** How many points along the edge key the angle, besides the four corners. */
const SAMPLES = 64;

/** An angle the comet's gradient starts from, at a share of its lap. */
export interface CometKey {
  readonly offset: number;
  readonly angle: number;
}

/**
 * The steady comet's lap of a `width` × `height` box: the angle its gradient starts from, keyed to
 * points evenly spaced along the box's edge (and its corners), from the middle of the top edge
 * clockwise round to it, and how long the lap takes at `STEADY_PX_PER_S`. A gradient turned at one
 * angular speed runs faster along a wide box's far ends; keyed so, its head covers the same pixels
 * in the same time all the way round. Internal.
 */
export function cometKeys(width: number, height: number): { keys: CometKey[]; lapMs: number } {
  const round = 2 * (width + height);
  if (!(width > 0 && height > 0)) {
    return { keys: [{ offset: 0, angle: 0 }, { offset: 1, angle: 360 }], lapMs: 1000 };
  }
  const halfW = width / 2;
  const halfH = height / 2;
  const corners = [halfW, halfW + height, 1.5 * width + height, 1.5 * width + 2 * height];
  const along = new Set<number>(corners);
  for (let i = 0; i < SAMPLES; i++) along.add((round * i) / SAMPLES);
  const keys = [...along]
    .sort((a, b) => a - b)
    .map((s) => {
      const [x, y] = pointAt(s, width, height, halfW, halfH);
      // A conic gradient's angle is 0 straight up and grows clockwise.
      const angle = (Math.atan2(x, -y) * 180) / Math.PI;
      return { offset: s / round, angle: angle < 0 ? angle + 360 : angle };
    });
  keys[0] = { offset: 0, angle: 0 };
  keys.push({ offset: 1, angle: 360 });
  return { keys, lapMs: (round / STEADY_PX_PER_S) * 1000 };
}

/** The point `s` along the edge from the middle of the top, clockwise, relative to the center. */
function pointAt(s: number, width: number, height: number, halfW: number, halfH: number) {
  if (s <= halfW) return [s, -halfH];
  if (s <= halfW + height) return [halfW, -halfH + (s - halfW)];
  if (s <= 1.5 * width + height) return [halfW - (s - halfW - height), halfH];
  if (s <= 1.5 * width + 2 * height) return [-halfW, halfH - (s - 1.5 * width - height)];
  return [-halfW + (s - 1.5 * width - 2 * height), -halfH];
}

/**
 * The steady comet's motion: the box's two glow layers (`::before` and its blurred `::after`) turn
 * by the Web Animations API, keyed by `cometKeys` for the frame's size, running while the board
 * works and paused otherwise, so the comet fades out where it stands. A new size keys it again,
 * keeping its place along the edge. Without the API (jsdom) it does nothing. Internal.
 */
export class SteadyComet {
  private animations: Animation[] = [];
  private lapMs = 0;

  constructor(private readonly frame: HTMLElement) {}

  /** The board works (true) or not: the comet runs or pauses. */
  running(on: boolean): void {
    if (on && this.animations.length === 0) this.start();
    for (const animation of this.animations) {
      if (on) animation.play();
      else animation.pause();
    }
  }

  /** The frame has another size: the lap is keyed again, at the same share of it. */
  resized(): void {
    if (this.animations.length === 0) return;
    const { keys, lapMs } = this.keys();
    for (const animation of this.animations) {
      const time = Number(animation.currentTime ?? 0);
      const share = this.lapMs > 0 ? (time % this.lapMs) / this.lapMs : 0;
      animation.effect?.updateTiming({ duration: lapMs });
      (animation.effect as KeyframeEffect | null)?.setKeyframes(frames(keys));
      animation.currentTime = share * lapMs;
    }
    this.lapMs = lapMs;
  }

  destroy(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations = [];
  }

  private start(): void {
    if (typeof this.frame.animate !== 'function') return;
    const { keys, lapMs } = this.keys();
    this.lapMs = lapMs;
    this.animations = (['::before', '::after'] as const).map((pseudoElement) =>
      this.frame.animate(frames(keys), {
        duration: lapMs,
        iterations: Infinity,
        easing: 'linear',
        pseudoElement,
      }),
    );
  }

  private keys() {
    const box = this.frame.getBoundingClientRect();
    return cometKeys(box.width, box.height);
  }
}

/** The keys as keyframes of the registered angle property. */
function frames(keys: readonly CometKey[]): Keyframe[] {
  return keys.map((key) => ({ offset: key.offset, '--neat-glow-angle': `${key.angle}deg` }));
}
