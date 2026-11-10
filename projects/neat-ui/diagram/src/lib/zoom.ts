import { select, type Selection } from 'd3-selection';
import {
  type D3ZoomEvent,
  zoom,
  type ZoomBehavior,
  zoomIdentity,
  zoomTransform,
  type ZoomTransform,
} from 'd3-zoom';
import { FIT_MARGIN, fitTransform, ZOOM_LIMITS } from './fit';
import type { Rect } from './layout';

/*
 * Pan, zoom and fit for one diagram, as the Autoware demo's System page does them: the view fits
 * the level by itself (on its first size, a resize, a new extent, a new level, a new height of
 * what covers its top) until the user pans or zooms; Fit fits again and hands the view back.
 * d3-zoom handles the pointer (drag, wheel, pinch, double-click) on the box; the keys are this
 * unit's, and so is the wheel's default: every wheel over the box is the diagram's, also at the
 * zoom's limits, where d3-zoom alone lets the page scroll away under the pointer. The transform is written to the
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
/**
 * How far a press may move, in px on screen, and still be a click: a hand on a mouse or a finger
 * on a pad jitters a pixel or two while it clicks. Within it, the press is not the user's drag
 * (the view keeps fitting by itself) and the click still reaches what was pressed.
 */
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

/**
 * Where a mouse event, or a touch event with one finger, happens (px on screen); null for any
 * other event, or a touch with more fingers than one.
 */
function pointOf(event: Event): { x: number; y: number } | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  if (typeof TouchEvent === 'function' && event instanceof TouchEvent) {
    const [touch, more] = Array.from(event.touches);
    return touch && !more ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return null;
}

/**
 * How far to move the span from `start` to `end` (px on screen) so it lies inside `0..room`, a fit
 * margin in from each side; one longer than that room shows from its start. 0 when it is inside,
 * or less than a pixel out: a fitted level's edge lands on the margin give or take the transform's
 * rounding (23.9999 px), and a sub-pixel pan would count as the user's and end the fitting.
 */
function shiftInto(start: number, end: number, room: number): number {
  const low = FIT_MARGIN;
  const high = room - FIT_MARGIN;
  let shift = 0;
  if (start < low) shift = low - start;
  else if (end > high) shift = Math.max(high - end, low - start);
  return Math.abs(shift) < 1 ? 0 : shift;
}

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
  /** What covers the top of the box (`setTopInset`). */
  private topInset: HTMLElement | null = null;
  /** Set once the user pans or zooms; the view then fits only when asked or on a new level. */
  private userMoved = false;
  /**
   * True while this unit sets the transform. During a user's press d3-zoom gives every zoom event
   * the press's event, this unit's own moves too; they are not the user's.
   */
  private ownMove = false;
  /**
   * Where the press in progress went down (px on screen), until it moves more than
   * `CLICK_DISTANCE` from there; null without a press, or once it has.
   */
  private press: { readonly x: number; readonly y: number } | null = null;
  /** The fit or key zoom in flight: where it goes and the frame it waits for. */
  private animation: { readonly to: ZoomTransform; readonly frame: number } | null = null;

  constructor(
    private readonly box: HTMLElement,
    private readonly content: HTMLElement,
    private readonly edges: SVGElement,
    /** Called after each new transform is written (the messaging layer redraws by it). */
    private readonly onDraw: () => void = () => undefined,
  ) {
    this.behavior = zoom<HTMLElement, unknown>()
      .scaleExtent([ZOOM_LIMITS[0], ZOOM_LIMITS[1]])
      // d3-zoom swallows the click that ends a drag; a click that jitters is still a click.
      .clickDistance(CLICK_DISTANCE)
      .on('start', (event: D3ZoomEvent<HTMLElement, unknown>) => {
        this.press = event.sourceEvent ? pointOf(event.sourceEvent) : null;
      })
      .on('zoom', (event: D3ZoomEvent<HTMLElement, unknown>) => {
        // A user's gesture that changes the view: d3-zoom emits `zoom` on a drag's move, a wheel,
        // a pinch or a double-click, not on a press alone (`start`), so a click or a tap on the
        // box (focusing it, a block's button) leaves the view fitting by itself.
        if (event.sourceEvent && !this.ownMove && this.isUsers(event.sourceEvent)) this.moved();
        this.draw(event.transform);
      })
      .on('end', () => (this.press = null));
    this.syncDuration();
    this.motion?.addEventListener('change', this.syncDuration);
    this.selection = select(box).call(this.behavior);
    box.addEventListener('keydown', this.keydown);
    box.addEventListener('focusin', this.focusIn);
    box.addEventListener('wheel', this.wheel, { passive: false });
    // Its first report is the box's first size: the first fit, or none while it has none. It
    // watches the top inset too (`setTopInset`).
    this.observer = new ResizeObserver(() => this.autoFit());
    this.observer.observe(box);
  }

  /** The transform now: d3-zoom's, kept on the box, read without a signal. */
  get transform(): ZoomTransform {
    return zoomTransform(this.box);
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

  /**
   * An element over the top of the box (the level bar), whose height a fit leaves free above the
   * level; null for none. Watched, so a new height (its path wrapping) fits again.
   */
  setTopInset(element: HTMLElement | null): void {
    if (element === this.topInset) return;
    if (this.topInset) this.observer.unobserve(this.topInset);
    this.topInset = element;
    if (element) this.observer.observe(element);
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
    // Setting the transform interrupts d3-zoom's double-click transition in flight, which would
    // otherwise go on writing to the content for up to 250 ms.
    this.jump(zoomTransform(this.box));
    this.observer.disconnect();
    this.box.removeEventListener('keydown', this.keydown);
    this.box.removeEventListener('focusin', this.focusIn);
    this.box.removeEventListener('wheel', this.wheel);
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

  /**
   * The transform that fits the level in the box below the top inset; null without a level or a
   * box size.
   */
  private fitted(): ZoomTransform | null {
    if (!this.extent) return null;
    const inset = this.insetHeight();
    const box = { w: this.box.clientWidth, h: this.box.clientHeight - inset };
    const fit = fitTransform(this.extent, box);
    return fit && zoomIdentity.translate(fit.x, fit.y + inset).scale(fit.k);
  }

  /**
   * How much of the box's top the inset covers, px on screen; none in a box it would fill, where
   * the level is better drawn under it than not at all.
   */
  private insetHeight(): number {
    const height = this.topInset?.offsetHeight ?? 0;
    return height < this.box.clientHeight ? height : 0;
  }

  /**
   * Whether a zoom event from `source` is the user's: a drag's move only once it is more than
   * `CLICK_DISTANCE` from its press (d3-zoom emits one on any move, a click's jitter too); a wheel,
   * a pinch and a double-click at once.
   */
  private isUsers(source: Event): boolean {
    if (!this.press || (source.type !== 'mousemove' && source.type !== 'touchmove')) return true;
    const at = pointOf(source);
    // A second finger (a pinch) is the user's at once.
    if (!at) return true;
    if (Math.hypot(at.x - this.press.x, at.y - this.press.y) <= CLICK_DISTANCE) return false;
    this.press = null;
    return true;
  }

  private moved(): void {
    this.userMoved = true;
    this.stopAnimation();
  }

  /**
   * The zoom goes to the edges' SVG as `--diagram-zoom` too, for what keeps its size on screen
   * (an edge's hit path): `vector-effect: non-scaling-stroke` does not undo a CSS transform on an
   * HTML ancestor, only the SVG's own. On the SVG, not the content, since the hit paths are its
   * only readers: a custom property set on the content would restyle the whole drawing each zoom.
   */
  private draw({ k, x, y }: ZoomTransform): void {
    this.content.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    this.edges.style.setProperty('--diagram-zoom', String(k));
    this.onDraw();
  }

  /** Sets the transform at once; d3-zoom keeps it and draws it through `draw`. */
  private jump(to: ZoomTransform): void {
    this.ownMove = true;
    try {
      this.behavior.transform(this.selection, to);
    } finally {
      this.ownMove = false;
    }
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
  /** Every wheel over the box zooms the diagram, and never scrolls the page, at a limit too. */
  private readonly wheel = (event: WheelEvent): void => {
    event.preventDefault();
  };

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

  /**
   * A part of the drawing the keyboard focuses (an open button, a control in a note) is panned
   * into view, as a page scrolls to what Tab reaches; the box clips and never scrolls itself. A
   * press focuses what it presses, which is in view.
   */
  private readonly focusIn = (event: FocusEvent): void => {
    const part = event.target;
    if (!(part instanceof Element) || !this.content.contains(part)) return;
    if (!part.matches(':focus-visible')) return;
    const box = this.box.getBoundingClientRect();
    const rect = part.getBoundingClientRect();
    const left = box.left + this.box.clientLeft;
    const top = box.top + this.box.clientTop;
    const dx = shiftInto(rect.left - left, rect.right - left, this.box.clientWidth);
    const inset = this.insetHeight();
    const height = this.box.clientHeight - inset;
    const dy = shiftInto(rect.top - top - inset, rect.bottom - top - inset, height);
    if (dx === 0 && dy === 0) return;
    this.moved();
    const { k, x, y } = zoomTransform(this.box);
    this.jump(zoomIdentity.translate(x + dx, y + dy).scale(k));
  };

  /** `from` zoomed by `by` within the limits, the point at the box's centre staying there. */
  private scaledAboutCentre(from: ZoomTransform, by: number): ZoomTransform {
    const k = Math.min(Math.max(from.k * by, ZOOM_LIMITS[0]), ZOOM_LIMITS[1]);
    const centre: [number, number] = [this.box.clientWidth / 2, this.box.clientHeight / 2];
    const [px, py] = from.invert(centre);
    return zoomIdentity.translate(centre[0] - px * k, centre[1] - py * k).scale(k);
  }
}
