import { select, type Selection } from 'd3-selection';
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
  zoomTransform,
  type ZoomTransform,
} from 'd3-zoom';
import { fitTransform, ZOOM_LIMITS } from './fit';
import type { Rect } from './layout';

/*
 * Pan, zoom and fit for one diagram, as the Autoware demo's System page does them: the view fits
 * the level by itself (on its first size, a resize, a new extent, a new level) until the user pans
 * or zooms; Fit fits again and hands the view back. d3-zoom handles the pointer (drag, wheel,
 * pinch, double-click) on the box; the keys are this unit's. The transform is written to the
 * content container's style, never through a signal, and every listener, the box's
 * ResizeObserver and the animation frames stay here (AGENTS.md: raw browser APIs stay isolated,
 * outside change detection).
 */

/** How long a fit, a key's zoom and d3-zoom's double-click animate, unless reduced motion. */
const ANIMATION_MS = 250;
/** How far an arrow key pans, in px on screen. */
const PAN_STEP = 48;
/** How much `+` zooms in and `-` out. */
const ZOOM_STEP = 1.25;
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

/** The diagram's pan and zoom on its box. Created once the box and its content are rendered. */
export class DiagramZoom {
  private readonly behavior: ZoomBehavior<HTMLElement, unknown>;
  private readonly selection: Selection<HTMLElement, unknown, null, undefined>;
  private readonly observer: ResizeObserver;
  /** Its `matches` is read at each move, so a setting changed on an open page applies. */
  private readonly motion: MediaQueryList | null =
    typeof matchMedia === 'function' ? matchMedia(REDUCED_MOTION) : null;
  private extent: Rect | null = null;
  /** Set once the user pans or zooms; the view then fits only when asked or on a new level. */
  private userMoved = false;
  /** The fit or key zoom in flight: where it goes and the frame it waits for. */
  private animation: { readonly to: ZoomTransform; readonly frame: number } | null = null;

  constructor(
    private readonly box: HTMLElement,
    private readonly content: HTMLElement,
  ) {
    this.behavior = zoom<HTMLElement, unknown>()
      .scaleExtent([ZOOM_LIMITS[0], ZOOM_LIMITS[1]])
      .on('start', (event: D3ZoomEvent<HTMLElement, unknown>) => {
        // Only the user's gestures carry an event; this unit's own moves carry none.
        if (event.sourceEvent) this.moved();
      })
      .on('zoom', (event: D3ZoomEvent<HTMLElement, unknown>) => this.draw(event.transform));
    this.syncDuration();
    this.motion?.addEventListener('change', this.syncDuration);
    this.selection = select(box).call(this.behavior);
    box.addEventListener('keydown', this.keydown);
    // Its first report is the box's first size: the first fit, or none while it has none.
    this.observer = new ResizeObserver(() => this.autoFit());
    this.observer.observe(box);
  }

  /** The drawn level's extent (`levelExtent`); a change fits, unless the user moved the view. */
  setExtent(extent: Rect | null): void {
    const known = this.extent;
    const same =
      known?.x === extent?.x &&
      known?.y === extent?.y &&
      known?.w === extent?.w &&
      known?.h === extent?.h;
    if (same) return;
    this.extent = extent;
    this.autoFit();
  }

  /** Fits the level, animated, and hands the view back: it fits by itself again. */
  fit(): void {
    this.userMoved = false;
    const to = this.fitted();
    if (to) this.animate(to);
  }

  /** A new level is shown: it fits at once, whatever the user did with the last one. */
  levelChanged(): void {
    this.userMoved = false;
    this.autoFit();
  }

  destroy(): void {
    this.stopAnimation();
    this.observer.disconnect();
    this.box.removeEventListener('keydown', this.keydown);
    this.motion?.removeEventListener('change', this.syncDuration);
    this.selection.on('.zoom', null);
  }

  /** A fit of its own: at once, as it follows a resize or a new level as they happen. */
  private autoFit(): void {
    if (this.userMoved) return;
    const to = this.fitted();
    if (!to) return;
    this.stopAnimation();
    this.jump(to);
  }

  /** The transform that fits the level in the box; null without a level or a box size. */
  private fitted(): ZoomTransform | null {
    if (!this.extent) return null;
    const fit = fitTransform(this.extent, { w: this.box.clientWidth, h: this.box.clientHeight });
    return fit && zoomIdentity.translate(fit.x, fit.y).scale(fit.k);
  }

  private moved(): void {
    this.userMoved = true;
    this.stopAnimation();
  }

  /**
   * The zoom goes to the content as `--diagram-zoom` too, for what keeps its size on screen (an
   * edge's hit path): `vector-effect: non-scaling-stroke` does not undo a CSS transform on an
   * HTML ancestor, only the SVG's own.
   */
  private draw({ k, x, y }: ZoomTransform): void {
    this.content.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    this.content.style.setProperty('--diagram-zoom', String(k));
  }

  /** Sets the transform at once; d3-zoom keeps it and draws it through `draw`. */
  private jump(to: ZoomTransform): void {
    this.behavior.transform(this.selection, to);
  }

  /**
   * Moves to `to` over 250 ms, or at once under reduced motion. Zoom and translation run in step,
   * so a zoom about a point keeps that point still all the way.
   */
  private animate(to: ZoomTransform): void {
    this.stopAnimation();
    if (this.motion?.matches) return this.jump(to);
    const from = zoomTransform(this.box);
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

  /** d3-zoom's double-click (and double-tap) animates as long as a fit, or jumps. */
  private readonly syncDuration = (): void => {
    this.behavior.duration(this.motion?.matches ? 0 : ANIMATION_MS);
  };

  /**
   * The keys, while the box itself has focus (an app's control inside it keeps its keys): arrows
   * pan, `+`/`=` and `-` zoom about the centre, `0` fits. A key with Ctrl, Meta or Alt is the
   * browser's (Ctrl `+` zooms the page).
   */
  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.target !== this.box || event.ctrlKey || event.metaKey || event.altKey) return;
    const pan = PAN_KEYS[event.key];
    const by = ZOOM_KEYS[event.key];
    if (pan) {
      this.moved();
      const { k, x, y } = zoomTransform(this.box);
      this.jump(zoomIdentity.translate(x + pan[0], y + pan[1]).scale(k));
    } else if (by) {
      // On from where a zoom in flight is going, so quick presses add up.
      const from = this.animation?.to ?? zoomTransform(this.box);
      this.moved();
      this.animate(this.scaledAboutCentre(from, by));
    } else if (event.key === '0') {
      this.fit();
    } else {
      return;
    }
    event.preventDefault();
  };

  /** `from` zoomed by `by` within the limits, the point at the box's centre staying there. */
  private scaledAboutCentre(from: ZoomTransform, by: number): ZoomTransform {
    const k = Math.min(Math.max(from.k * by, ZOOM_LIMITS[0]), ZOOM_LIMITS[1]);
    const centre: [number, number] = [this.box.clientWidth / 2, this.box.clientHeight / 2];
    const [px, py] = from.invert(centre);
    return zoomIdentity.translate(centre[0] - px * k, centre[1] - py * k).scale(k);
  }
}
