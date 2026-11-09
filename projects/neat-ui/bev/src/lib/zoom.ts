import { select, type Selection } from 'd3-selection';
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
  zoomTransform,
  type ZoomTransform,
} from 'd3-zoom';
import { type PlotArea, ZOOM_MAX } from './geometry';

/*
 * The bird's-eye view's pan and zoom, as the diagram's: d3-zoom handles the pointer on the box
 * (drag, wheel, pinch, double-click), this unit the keys and the reset. The view zooms from the
 * whole range (1) in to a quarter of it (`ZOOM_MAX`) and pans only within the plot, so the vehicle's
 * surroundings never leave it. Every listener stays here, outside change detection (AGENTS.md: raw
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
  /** The plot the view pans within; none before the box has a size. */
  private area: PlotArea | null = null;
  /** The key zoom or reset in flight: where it goes and the frame it waits for. */
  private animation: { readonly to: ZoomTransform; readonly frame: number } | null = null;

  constructor(
    private readonly box: HTMLElement,
    /** Called with each new transform, after d3-zoom has kept it on the box. */
    private readonly onChange: (transform: ZoomTransform) => void,
  ) {
    this.behavior = zoom<HTMLElement, unknown>()
      .scaleExtent([1, ZOOM_MAX])
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
  }

  /** The transform now, as d3-zoom keeps it on the box. */
  get transform(): ZoomTransform {
    return zoomTransform(this.box);
  }

  /**
   * The plot the view pans within (a resize, a new shape): the view stays zoomed as it was and is
   * moved back inside the plot if it now lies outside.
   */
  setPlot(area: PlotArea): void {
    this.area = area;
    const { cx, cy, halfWidth, halfHeight } = area;
    this.behavior.translateExtent([
      [cx - halfWidth, cy - halfHeight],
      [cx + halfWidth, cy + halfHeight],
    ]);
    // The view moves only if the new bounds leave it outside the plot.
    const now = this.transform;
    const inside = this.constrained(now);
    if (inside.k !== now.k || inside.x !== now.x || inside.y !== now.y) this.jump(inside);
  }

  /** Back to the whole range, animated. */
  reset(): void {
    this.animate(zoomIdentity);
  }

  destroy(): void {
    this.stopAnimation();
    this.box.removeEventListener('keydown', this.keydown);
    this.motion?.removeEventListener('change', this.syncDuration);
    this.selection.on('.zoom', null);
  }

  /** The viewport d3-zoom constrains to: the plot, or the box before it has one. */
  private extentOf(): [[number, number], [number, number]] {
    const area = this.area;
    if (!area)
      return [
        [0, 0],
        [this.box.clientWidth, this.box.clientHeight],
      ];
    return [
      [area.cx - area.halfWidth, area.cy - area.halfHeight],
      [area.cx + area.halfWidth, area.cy + area.halfHeight],
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
    const k = Math.min(Math.max(from.k * by, 1), ZOOM_MAX);
    const [[x0, y0], [x1, y1]] = this.extentOf();
    const centre: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
    const [px, py] = from.invert(centre);
    return zoomIdentity.translate(centre[0] - px * k, centre[1] - py * k).scale(k);
  }
}
