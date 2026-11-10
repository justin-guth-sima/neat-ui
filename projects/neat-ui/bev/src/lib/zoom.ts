import { select, type Selection } from 'd3-selection';
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
  zoomTransform,
  type ZoomTransform,
} from 'd3-zoom';
import { type ScreenRect, ZOOM_EXTENT } from './geometry';

/*
 * The bird's-eye view's pan and zoom, as the diagram's: d3-zoom handles the pointer on the box
 * (drag, wheel, pinch, double-click), this unit the keys, the reset and the wheel's default. The
 * view zooms within its limits (`setScaleExtent`; from the default, 1, in to four times it unless
 * the app says otherwise) and pans only within its bounds (`setBounds`). Every wheel
 * over the box is the view's, also at the zoom's limits, where d3-zoom lets it through: the page
 * would scroll away under the pointer. Made only while the view's `zoom` is on; `destroy` leaves
 * the box as it found it. Every listener stays here, outside change detection (AGENTS.md: raw
 * browser APIs stay isolated); the owner hears each new transform through `onChange`.
 */

/** How long a key's zoom and the reset animate, unless reduced motion. */
const ANIMATION_MS = 250;
/** How far an arrow key pans, px on screen. */
const PAN_STEP = 48;
/** How much `+` zooms in and `-` out. */
const ZOOM_STEP = 1.25;
/** How far a press may move and still be a click (a tap that reads out an object). */
const CLICK_DISTANCE = 3;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** How each arrow key moves the content: the view goes the way the key points. */
const PAN_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [PAN_STEP, 0],
  ArrowRight: [-PAN_STEP, 0],
  ArrowUp: [0, PAN_STEP],
  ArrowDown: [0, -PAN_STEP],
};
const ZOOM_KEYS: Readonly<Record<string, number>> = {
  '+': ZOOM_STEP,
  '=': ZOOM_STEP,
  '-': 1 / ZOOM_STEP,
};

/** Cubic ease in and out, d3's default for a transition. */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Whether `transform` is the default view: the whole range, the vehicle at the centre. */
export function isDefault({ k, x, y }: ZoomTransform): boolean {
  return k === 1 && Math.abs(x) < 0.5 && Math.abs(y) < 0.5;
}

export class BevZoom {
  private readonly behavior: ZoomBehavior<HTMLElement, unknown>;
  private readonly selection: Selection<HTMLElement, unknown, null, undefined>;
  /** Its `matches` is read at each move, so a setting changed on an open page applies. */
  private readonly motion: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION) : null;
  /** The box's size, CSS px; none before it has one. */
  private size: readonly [number, number] | null = null;
  /** How far the view zooms out and in, relative to the default view. */
  private limits: readonly [number, number] = ZOOM_EXTENT;
  /** The key zoom or reset in flight: where it goes and the frame it waits for. */
  private animation: { readonly to: ZoomTransform; readonly frame: number } | null = null;

  constructor(
    private readonly box: HTMLElement,
    /** Called with each new transform, after d3-zoom has kept it on the box. */
    private readonly onChange: (transform: ZoomTransform) => void,
  ) {
    this.behavior = zoom<HTMLElement, unknown>()
      .scaleExtent([...this.limits])
      .clickDistance(CLICK_DISTANCE)
      .extent(() => this.extentOf())
      .translateExtent([
        [-Infinity, -Infinity],
        [Infinity, Infinity],
      ])
      .on('zoom', (event: D3ZoomEvent<HTMLElement, unknown>) => {
        if (event.sourceEvent) this.stopAnimation();
        this.onChange(event.transform);
      });
    this.syncDuration();
    this.motion?.addEventListener('change', this.syncDuration);
    this.selection = select(box).call(this.behavior);
    box.addEventListener('keydown', this.keydown);
    box.addEventListener('wheel', this.wheel, { passive: false });
  }

  /** The transform now, as d3-zoom keeps it on the box. */
  get transform(): ZoomTransform {
    return zoomTransform(this.box);
  }

  /**
   * The box's size and what the view pans within, in the default view's pixels (a resize, a new
   * plot): the view stays zoomed as it was and is moved back inside if it now lies outside.
   */
  setBounds(width: number, height: number, [[x0, y0], [x1, y1]]: ScreenRect): void {
    this.size = [width, height];
    this.behavior.translateExtent([
      [x0, y0],
      [x1, y1],
    ]);
    // The view moves only if the new bounds leave it outside the plot.
    const now = this.transform;
    const inside = this.constrained(now);
    if (inside.k !== now.k || inside.x !== now.x || inside.y !== now.y) this.jump(inside);
  }

  /**
   * How far the view zooms out and in (`zoomLimits` makes sure 1 is within): a view zoomed beyond
   * new limits is brought back within them.
   */
  setScaleExtent(min: number, max: number): void {
    if (min === this.limits[0] && max === this.limits[1]) return;
    this.limits = [min, max];
    this.behavior.scaleExtent([min, max]);
    const now = this.transform;
    const k = Math.min(Math.max(now.k, min), max);
    if (k !== now.k) this.jump(this.constrained(this.scaledAboutCentre(now, k / now.k)));
  }

  /** Back to the default view, animated. */
  reset(): void {
    this.animate(zoomIdentity);
  }

  destroy(): void {
    this.stopAnimation();
    this.box.removeEventListener('keydown', this.keydown);
    this.box.removeEventListener('wheel', this.wheel);
    this.motion?.removeEventListener('change', this.syncDuration);
    this.selection.on('.zoom', null);
    // d3-zoom's own mark on the box, so a box that no longer zooms taps as any other.
    this.box.style.removeProperty('-webkit-tap-highlight-color');
  }

  /** The viewport d3-zoom constrains to: the box. */
  private extentOf(): [[number, number], [number, number]] {
    const [width, height] = this.size ?? [this.box.clientWidth, this.box.clientHeight];
    return [
      [0, 0],
      [width, height],
    ];
  }

  private translateExtent(): [[number, number], [number, number]] {
    return this.behavior.translateExtent();
  }

  /** Sets the transform at once; d3-zoom keeps it and reports it through `onChange`. */
  private jump(to: ZoomTransform): void {
    this.behavior.transform(this.selection, to);
  }

  /** Moves to `to` over 250 ms, or at once under reduced motion. */
  private animate(to: ZoomTransform): void {
    this.stopAnimation();
    if (this.motion?.matches) return this.jump(to);
    const from = this.transform;
    const start = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - start) / ANIMATION_MS, 1);
      if (t === 1) {
        this.animation = null;
        return this.jump(to);
      }
      const e = easeInOut(t);
      const at = (a: number, b: number) => a + (b - a) * e;
      this.jump(zoomIdentity.translate(at(from.x, to.x), at(from.y, to.y)).scale(at(from.k, to.k)));
      this.animation = { to, frame: requestAnimationFrame(step) };
    };
    this.animation = { to, frame: requestAnimationFrame(step) };
  }

  private stopAnimation(): void {
    if (this.animation) cancelAnimationFrame(this.animation.frame);
    this.animation = null;
  }

  /** Every wheel over the box zooms the view, and never scrolls the page, at a limit too. */
  private readonly wheel = (event: WheelEvent): void => {
    event.preventDefault();
  };

  /** d3-zoom's double-click (and double-tap) animates as long as the keys' zoom, or jumps. */
  private readonly syncDuration = (): void => {
    this.behavior.duration(this.motion?.matches ? 0 : ANIMATION_MS);
  };

  /**
   * The keys, while the box itself has focus: arrows pan, `+`/`=` and `-` zoom about the plot's
   * centre, `0` resets. A key with Ctrl, Meta or Alt is the browser's (Ctrl `+` zooms the page).
   */
  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.target !== this.box || event.ctrlKey || event.metaKey || event.altKey) return;
    const pan = PAN_KEYS[event.key];
    const by = ZOOM_KEYS[event.key];
    if (pan) {
      this.stopAnimation();
      const { k, x, y } = this.transform;
      this.jump(this.constrained(zoomIdentity.translate(x + pan[0], y + pan[1]).scale(k)));
    } else if (by) {
      // On from where a zoom in flight is going, so quick presses add up.
      const from = this.animation?.to ?? this.transform;
      this.animate(this.constrained(this.scaledAboutCentre(from, by)));
    } else if (event.key === '0') {
      this.reset();
    } else {
      return;
    }
    event.preventDefault();
  };

  private constrained(transform: ZoomTransform): ZoomTransform {
    return this.behavior.constrain()(transform, this.extentOf(), this.translateExtent());
  }

  /** `from` zoomed by `by` within the limits, the plot's centre staying where it is. */
  private scaledAboutCentre(from: ZoomTransform, by: number): ZoomTransform {
    const k = Math.min(Math.max(from.k * by, this.limits[0]), this.limits[1]);
    const [[x0, y0], [x1, y1]] = this.extentOf();
    const centre: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
    const [px, py] = from.invert(centre);
    return zoomIdentity.translate(centre[0] - px * k, centre[1] - py * k).scale(k);
  }
}
