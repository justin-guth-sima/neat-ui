import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  NeatButton,
  NeatIcon,
  neatThemeColors,
  type NeatRgb,
  NeatSwatch,
  NeatTooltip,
  ThemeService,
  ɵNeatOverlayColors as NeatOverlayColors,
  ɵREADOUT_CLASSES as READOUT_CLASSES,
} from '@sima/neat-ui';
import { zoomIdentity, type ZoomTransform } from 'd3-zoom';
import type { NeatOverlayClassStyle } from '@sima/neat-ui/video';
import { BevCanvas, type BevInputs, type BevTheme } from './bev-canvas';
import { GUIDE_ALPHA, LabelColors, OUTLINE_ALPHA } from './colors';
import {
  type BevPlot,
  bevPlot,
  type BevView,
  defaultView,
  hitObject,
  onPlot,
  ZOOM_EXTENT,
  zoomLimits,
  panArea,
  plotAspect,
  type ScreenRect,
  spokeList,
  toScreen,
  toVehicle,
} from './geometry';
import type {
  NeatBevBounds,
  NeatBevFrame,
  NeatBevGuides,
  NeatBevLayer,
  NeatBevObject,
  NeatBevObjectId,
  NeatBevPick,
  NeatBevPoint,
  NeatBevOverflow,
  NeatBevShape,
  NeatBevSpoke,
} from './model';
import { BevReadout } from './readout';
import { SUMMARY_MS, summaryText } from './summary';
import { BevZoom, isDefault } from './zoom';

/** How far around an object the pointer still reads it out, CSS px: room for a small one. */
const HIT_TOLERANCE_PX = 4;

/**
 * The theme's tokens the plot draws its own parts in. The guides are the foreground, see-through
 * (`GUIDE_ALPHA`, `OUTLINE_ALPHA`), so that over the data they darken (or, dark, lighten) what they
 * cross and read as on top of it; an opaque line as light as the border would read as a gap.
 */
const TOKENS = {
  text: '--muted-foreground',
  vehicle: '--foreground',
  halo: '--neat-surface',
} as const;

/**
 * A bird's-eye view: what a vehicle sees around it, drawn from above.
 *
 * ```html
 * <neat-bev [frame]="frame()" [background]="map" [range]="60" zoom />
 * ```
 *
 * It draws three things:
 * - what the vehicle sees, `frame`: objects, points, lines and grids;
 * - what the app draws under it and over it, `background` and `foreground`;
 * - guides to read distances by, `shape`: rings in a circle, or a metric grid in a rectangle.
 *
 * Positions are in the vehicle's own frame: meters, x forward and y to the left. Forward is up on
 * the screen. Give the view a height, or it takes the shape's proportions.
 *
 * The data and the guides stop at the shape's edge, or run on over the whole box with `overflow`.
 * The guides lie over the data, or under it with `guides`.
 *
 * Labels take their colors from the page's class colors, as the video overlays' classes do. So
 * "car" has one color in the view and in every tile. `styles` sets a label's color and line, as
 * the tiles' class rows do.
 *
 * Hovering an object, or tapping it, reads it out beside it: its label, its distance from the
 * vehicle and its `text`.
 *
 * With `zoom`, the wheel, a pinch and a drag zoom and pan the view, the shape and all. The zoom
 * stays within `zoomExtent`, up to four times the default view unless it says otherwise. Panning
 * stays within what the default view shows and `panBounds`. With focus, the arrow keys pan, `+` and
 * `-` zoom, and `0` resets, as the reset button does while the view is zoomed.
 *
 * A screen reader hears the view as a figure named by `label`, with a summary of what it shows:
 * "18 car, 51 pedestrian within 60 m". The summary changes at most once a second.
 *
 * It draws on one canvas, outside change detection: at the next animation frame after anything
 * changes, and never while the page is hidden.
 */
@Component({
  selector: 'neat-bev',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NeatButton, NeatIcon, NeatSwatch, NeatTooltip],
  host: {
    role: 'figure',
    '[attr.aria-label]': 'label()',
    '[attr.tabindex]': 'zoom() ? 0 : null',
    '[style.aspect-ratio]': 'aspect()',
  },
  template: `
    <canvas #canvas aria-hidden="true"></canvas>
    <!-- What the picture shows, for a screen reader: written by the frames, at most once a second. -->
    <p #summary class="sr-only"></p>
    @if (zoomed()) {
      <!-- Pressed, it resets: its press is no drag of the view, nor its double-click a zoom. -->
      <button
        neatButton
        class="reset"
        variant="outlined"
        size="small"
        iconOnly
        type="button"
        aria-label="Reset view"
        neatTooltip="Reset view"
        neatTooltipPosition="left"
        (click)="reset()"
        (mousedown)="$event.stopPropagation()"
        (touchstart)="$event.stopPropagation()"
        (dblclick)="$event.stopPropagation()"
      >
        <neat-icon name="fit-all" [size]="16" />
      </button>
    }
    <!-- The object under the pointer; filled and placed by each frame, not by change detection. -->
    <div #readout class="readout" aria-hidden="true" hidden [class]="readoutClasses.box">
      <span [class]="readoutClasses.row"
        ><neat-swatch [color]="readoutColor()" /><span #name></span
      ></span>
      <span #distance [class]="readoutClasses.muted"></span>
      <span #text></span>
    </div>
  `,
  styleUrl: './bev.css',
})
export class NeatBev {
  /** What to draw now; null draws only the plot. Give a new object for each moment. */
  readonly frame = input<NeatBevFrame | null>(null);
  /**
   * Lines, polygons and points drawn under the data, which change rarely: a map's lanes, a
   * camera's field of view. Give a new object when it changes.
   */
  readonly background = input<NeatBevLayer | null>(null);
  /** The same, drawn over the data (and the guides): a zone around the vehicle, say. */
  readonly foreground = input<NeatBevLayer | null>(null);
  /**
   * The spokes: a number of them spaced evenly, or a list that places each one.
   *
   * A number spaces that many evenly from straight ahead: 12, every 30°, by default, and 0 for
   * none. A list places each one, from its own origin if it has one. That draws a rig's seams
   * between its cameras, say, or lines from where the cameras are mounted.
   */
  readonly spokes = input<number | readonly NeatBevSpoke[]>(12);
  /** Meters from the vehicle to the circle, and to the rectangle's edges without `bounds`. */
  readonly range = input(60);
  /** The circle of `range` with rings (`'round'`), or the rectangle `bounds` with a grid. */
  readonly shape = input<NeatBevShape>('round');
  /** The rectangle in meters (`'rect'`), as a grid sets one; null is ±`range`. */
  readonly bounds = input<NeatBevBounds | null>(null);
  /** Whether the shape's edge is drawn. */
  readonly outline = input(true, { transform: booleanAttribute });
  /** Whether the data and the guides stop at the shape (`'clip'`) or run on over the box. */
  readonly overflow = input<NeatBevOverflow>('clip');
  /** Whether rings or grid lines, spokes and the outline lie over the data. */
  readonly guides = input<NeatBevGuides>('over');
  /** Whether wheel, pinch, drag and keys zoom and pan the view; off, the page scrolls over it. */
  readonly zoom = input(false, { transform: booleanAttribute });
  /**
   * A rectangle in meters the view may also pan over, besides what the default view shows.
   *
   * With a smaller `range`, it makes a view that starts zoomed in and still reaches further out.
   */
  readonly panBounds = input<NeatBevBounds | null>(null);
  /**
   * How far the view zooms out and in, relative to the default view (1).
   *
   * By default it zooms in up to four times, and not out. A min below 1 zooms out beyond the
   * default view. The extent always takes in 1.
   */
  readonly zoomExtent = input<readonly [min: number, max: number]>(ZOOM_EXTENT);
  /**
   * The object outlined and read out, by its `id`, or its index without one.
   *
   * It is the one under the pointer while the pointer is over the view, and null once it leaves.
   * Otherwise it is the one the app sets. It changes when another object comes under the pointer,
   * not with every frame.
   */
  readonly hovered = model<NeatBevObjectId | null>(null);
  /** A click or tap on the view that is no drag: the object it hit (or null) and the point. */
  readonly activated = output<NeatBevPick>();
  /**
   * Where a mouse or pen is over the view, in meters; null when it leaves.
   *
   * It emits at most once a frame, and only when the point changed. A zoom moves it too.
   */
  readonly pointerMove = output<NeatBevPoint | null>();
  /** A label's color, line and width, as the video overlays' class rows set them for the tiles. */
  readonly styles = input<readonly NeatOverlayClassStyle[]>([]);
  /** The plot's accessible name. */
  readonly label = input("Bird's-eye view");

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly colors = new LabelColors(inject(NeatOverlayColors));
  private readonly themeColors = neatThemeColors(TOKENS, () => this.host);
  private readonly scheme = inject(ThemeService).scheme;

  /** The plot's own colors and font, as the canvas takes them; a new object for a new theme. */
  private readonly theme = computed<BevTheme>(() => {
    const colors = this.themeColors();
    const style = getComputedStyle(this.host);
    const fallback = style.color;
    const css = (rgb: NeatRgb | null, alpha = 1): string => (rgb ? cssColor(rgb, alpha) : fallback);
    return {
      line: css(colors.vehicle, GUIDE_ALPHA),
      strong: css(colors.vehicle, OUTLINE_ALPHA),
      text: css(colors.text),
      vehicle: css(colors.vehicle),
      halo: css(colors.halo),
      surface: colors.halo,
      font: `${style.fontSize} ${style.fontFamily}`,
    };
  });

  private readonly inputs = computed<BevInputs>(() => ({
    plot: bevPlot(this.shape(), this.range(), this.bounds()),
    background: this.background(),
    foreground: this.foreground(),
    spokes: spokeList(this.spokes()),
    outline: this.outline(),
    overflow: this.overflow(),
    guides: this.guides(),
  }));

  /** The host's proportions without a height of the app's: the shape's. */
  protected readonly aspect = computed(() => `${plotAspect(this.inputs().plot)} / 1`);

  protected readonly readoutClasses = READOUT_CLASSES;
  private readonly readoutBox = viewChild.required<ElementRef<HTMLElement>>('readout');
  /** The color of the object read out, for its swatch: it changes only with another object. */
  protected readonly readoutColor = signal('');
  private readonly readoutName = viewChild.required<ElementRef<HTMLElement>>('name');
  private readonly readoutDistance = viewChild.required<ElementRef<HTMLElement>>('distance');
  private readonly readoutText = viewChild.required<ElementRef<HTMLElement>>('text');
  private readonly summaryElement = viewChild.required<ElementRef<HTMLElement>>('summary');

  /** Whether the view is zoomed or panned away from the whole range: the reset button shows. */
  protected readonly zoomed = signal(false);

  private canvas: BevCanvas | null = null;
  private readout: BevReadout | null = null;
  /** Where the pointer is over the box (CSS px), or the last tap; null for neither. */
  private pointer: { x: number; y: number } | null = null;
  /** Whether `pointer` is a mouse or pen over the box, not a tap: what `pointerMove` reports. */
  private hovering = false;
  /** Whether the pointer has left, or the readout was put away: the hover goes back to null. */
  private released = false;
  /** The point `pointerMove` last reported. */
  private reported: NeatBevPoint | null = null;
  /** The view, the inputs and the frame last drawn: what a click is tested against. */
  private drawn: { view: BevView; inputs: BevInputs; frame: NeatBevFrame | null } | null = null;
  /** The kind of the last press: a touch reads out by a tap, a mouse or pen by hovering. */
  private pressedBy = '';
  /** The summary written, the frame and plot it was made from, when, and the one waiting. */
  private summary = '';
  private summaryOf: { frame: NeatBevFrame | null; plot: BevPlot } | null = null;
  private summaryAt = -Infinity;
  private summaryTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly vehiclePoint = { x: 0, y: 0 };
  private readonly screenPoint = { x: 0, y: 0 };
  /** The pan and zoom, while `zoom` is on and the view is rendered. */
  private zoomer: BevZoom | null = null;
  /** Whether the view has rendered: the zoom is made from then on. */
  private rendered = false;
  /** The pan and zoom on top of the default view. */
  private transform: ZoomTransform = zoomIdentity;
  /** The box and the pan bounds the zoom was last given, so a frame gives it only new ones. */
  private bounded: { width: number; height: number; pan: ScreenRect } | null = null;
  /** The style rows the colors were last given. */
  private stylesGiven: readonly NeatOverlayClassStyle[] | null = null;
  private width = 0;
  private height = 0;
  private request = 0;
  private destroyed = false;

  constructor() {
    // Anything that changes what is drawn asks for a frame; new style rows apply from it on.
    effect(() => {
      const styles = this.styles();
      this.frame();
      this.inputs();
      this.hovered();
      this.panBounds();
      this.zoomExtent();
      // The scheme, not the colors: they are resolved (on a canvas) only when a frame draws.
      this.scheme();
      untracked(() => {
        if (styles !== this.stylesGiven) this.colors.setStyles((this.stylesGiven = styles));
        this.schedule();
      });
    });
    // The zoom is made while it is on, and goes with its listeners when it turns off.
    effect(() => {
      const on = this.zoom();
      untracked(() => this.syncZoom(on));
    });
    let observer: ResizeObserver | null = null;
    afterNextRender(() =>
      this.zone.runOutsideAngular(() => {
        if (this.destroyed) return;
        this.canvas = new BevCanvas(this.canvasElement().nativeElement);
        this.readout = new BevReadout(
          this.readoutBox().nativeElement,
          this.readoutName().nativeElement,
          this.readoutDistance().nativeElement,
          this.readoutText().nativeElement,
        );
        this.host.addEventListener('pointermove', this.moved);
        this.host.addEventListener('pointerleave', this.left);
        this.host.addEventListener('pointerdown', this.pointerDown);
        this.host.addEventListener('click', this.click);
        this.host.addEventListener('keydown', this.escape);
        this.rendered = true;
        this.syncZoom(untracked(this.zoom));
        observer = new ResizeObserver((entries) => {
          const box = entries.at(-1)?.borderBoxSize?.[0];
          if (!box) return;
          this.width = box.inlineSize;
          this.height = box.blockSize;
          this.canvas?.size(this.width, this.height);
          // Now, not at the next frame: the browser paints this frame at the new size, and an
          // old picture would show stretched to it for a frame (squished while resizing).
          this.drawNow();
        });
        observer.observe(this.host);
        this.document.addEventListener('visibilitychange', this.visibility);
        this.schedule();
      }),
    );
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      if (this.request !== 0) cancelAnimationFrame(this.request);
      this.request = 0;
      observer?.disconnect();
      this.zoomer?.destroy();
      clearTimeout(this.summaryTimer);
      this.host.removeEventListener('pointermove', this.moved);
      this.host.removeEventListener('pointerleave', this.left);
      this.host.removeEventListener('pointerdown', this.pointerDown);
      this.host.removeEventListener('click', this.click);
      this.host.removeEventListener('keydown', this.escape);
      this.document.removeEventListener('visibilitychange', this.visibility);
    });
  }

  /**
   * The color the view draws `label` in, for a swatch in a list beside it; null while it has none.
   *
   * ```html
   * <neat-bev #view [frame]="frame()" />
   * @if (view.colorOf('car'); as color) {
   *   <neat-swatch [color]="color" />
   * }
   * car
   * ```
   *
   * It is the label's row in `styles`, else its class color. A class has the same color in every
   * video tile of the page, so this is the color a tile's `colorOf` gives a detection of that
   * label without a style row.
   *
   * It is null for a label the page has not drawn yet, or no longer holds a color for: a class
   * gone for about 5 s may give its color to another. A style row's color it gives at once.
   *
   * It reads signals, so a template or a `computed` that calls it updates when a class color is
   * given or taken back, and when `styles` change. Asking records no draw, so it keeps no color
   * alive.
   */
  colorOf(label: string): string | null {
    return this.colors.heldColorOf(label, this.styles());
  }

  /** Back to the default view. */
  protected reset(): void {
    this.zoomer?.reset();
    this.host.focus();
  }

  /**
   * Makes the zoom when it turns on (once the view has rendered), outside change detection, or
   * takes it away when it turns off, the view back at the default.
   */
  private syncZoom(on: boolean): void {
    if (!this.rendered || this.destroyed || on === (this.zoomer !== null)) return;
    if (on) {
      this.zoomer = this.zone.runOutsideAngular(
        () =>
          new BevZoom(this.host, (transform) => {
            this.transform = transform;
            this.zoomed.set(!isDefault(transform));
            this.schedule();
          }),
      );
    } else {
      this.zoomer?.destroy();
      this.zoomer = null;
      this.transform = zoomIdentity;
      this.zoomed.set(false);
    }
    // The next frame gives a new zoom its bounds.
    this.bounded = null;
    this.schedule();
  }

  /** A frame, unless one is coming, the page is hidden, there is no canvas yet or it is gone. */
  private schedule(): void {
    if (this.request !== 0 || this.destroyed || !this.canvas || this.document.hidden) return;
    this.request = this.zone.runOutsideAngular(() => requestAnimationFrame(this.tick));
  }

  /**
   * Draws at once, in place of a frame that may be coming: from a `ResizeObserver`'s callback,
   * which runs after layout and before the paint, so the canvas is the new size when it is shown.
   */
  private drawNow(): void {
    if (this.request !== 0) cancelAnimationFrame(this.request);
    this.request = 0;
    if (this.destroyed || !this.canvas || this.document.hidden) return;
    this.tick();
  }

  /** Where `event` is over the box, CSS px. */
  private pointOf(event: MouseEvent): { x: number; y: number } {
    const rect = this.host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  /** A mouse or pen over the box reads out what it hovers; a finger does by tapping. */
  private readonly moved = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.pointer = this.pointOf(event);
    this.hovering = true;
    this.schedule();
  };

  private readonly left = (event: PointerEvent): void => {
    if (event.pointerType === 'touch') return;
    this.release();
  };

  /** No pointer any more: the hover goes back to null at the next frame. */
  private release(): void {
    this.pointer = null;
    this.hovering = false;
    this.released = true;
    this.schedule();
  }

  private readonly pointerDown = (event: PointerEvent): void => {
    this.pressedBy = event.pointerType;
  };

  /**
   * A click or tap that is no drag (d3-zoom swallows those) and not on the reset button: the app
   * hears what it hit; a tap also reads out what it lands on, or puts the readout away.
   */
  private readonly click = (event: MouseEvent): void => {
    if (event.target instanceof Element && event.target.closest('button')) return;
    const at = this.pointOf(event);
    if (this.pressedBy === 'touch') {
      this.pointer = at;
      this.hovering = false;
      this.schedule();
    }
    const drawn = this.drawn;
    if (!drawn || !(drawn.view.ppm > 0)) return;
    const point = toVehicle(drawn.view, at.x, at.y, { x: 0, y: 0 });
    const index = this.hitAt(drawn.view, drawn.inputs, drawn.frame, at);
    const object = index >= 0 ? (drawn.frame?.objects?.[index] ?? null) : null;
    const id = object ? (object.id ?? index) : null;
    this.zone.run(() => this.activated.emit({ object, id, x: point.x, y: point.y, event }));
  };

  private readonly escape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || this.pointer === null) return;
    this.release();
  };

  private readonly visibility = (): void => {
    if (!this.document.hidden) this.schedule();
  };

  private readonly tick = (): void => {
    this.request = 0;
    // Nothing to draw on before the box has a size: nothing is resolved either (the colors).
    if (this.destroyed || !this.canvas || this.width <= 0 || this.height <= 0) return;
    const ratio =
      typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const inputs = untracked(this.inputs);
    const { plot } = inputs;
    const start = defaultView(this.width, this.height, plot);
    if (this.zoomer) {
      const [min, max] = zoomLimits(untracked(this.zoomExtent));
      this.zoomer.setScaleExtent(min, max);
      const extra = untracked(this.panBounds);
      const pan = panArea(start, plot, inputs.overflow, this.width, this.height, extra);
      if (!sameBounds(this.bounded, this.width, this.height, pan)) {
        this.bounded = { width: this.width, height: this.height, pan };
        // May move the view back inside smaller bounds, setting `transform` before it is read.
        this.zoomer.setBounds(this.width, this.height, pan);
      }
    }
    const { k, x, y } = this.transform;
    const view: BevView = { ...start, k, tx: x, ty: y };
    const frame = untracked(this.frame);
    this.drawn = { view, inputs, frame };
    const hover = this.hover(view, inputs, frame);
    this.report(view);
    this.colors.begin(performance.now());
    this.canvas.draw(ratio, view, inputs, untracked(this.theme), this.colors, frame, hover);
    this.summarize(frame, plot);
    const object = hover >= 0 ? frame?.objects?.[hover] : undefined;
    if (object) {
      const at = toScreen(view, object.x, object.y, this.screenPoint);
      const color = this.colors.of(object.label).color;
      this.readoutColor.set(color);
      this.readout?.show(object, at.x, at.y, this.width, this.height);
    } else {
      this.readout?.hide();
    }
  };

  /**
   * Says what a new frame or range shows, at most once every `SUMMARY_MS`: one sooner waits for
   * its turn, and the newest frame by then is the one summed up.
   */
  private summarize(frame: NeatBevFrame | null, plot: BevPlot): void {
    if (this.summaryOf?.frame === frame && this.summaryOf.plot === plot) return;
    if (this.summaryTimer !== undefined) return;
    const wait = this.summaryAt + SUMMARY_MS - performance.now();
    if (wait > 0) {
      this.summaryTimer = setTimeout(() => {
        this.summaryTimer = undefined;
        if (!this.destroyed) this.summarize(untracked(this.frame), untracked(this.inputs).plot);
      }, wait);
      return;
    }
    this.summaryOf = { frame, plot };
    this.summaryAt = performance.now();
    const text = summaryText(frame?.objects, plot);
    if (text === this.summary) return;
    this.summary = text;
    this.summaryElement().nativeElement.textContent = text;
  }

  /**
   * The index of the object to outline and read out. While a pointer is over the view, the one
   * under it, and `hovered` follows when that is another object; otherwise the one `hovered`
   * names, as the app may have set it (null once the pointer has left).
   */
  private hover(view: BevView, inputs: BevInputs, frame: NeatBevFrame | null): number {
    const objects = frame?.objects ?? [];
    if (this.pointer) {
      const index = this.hitAt(view, inputs, frame, this.pointer);
      const id = index >= 0 ? (objects[index].id ?? index) : null;
      this.setHovered(id);
      return index;
    }
    if (this.released) {
      this.released = false;
      this.setHovered(null);
    }
    // One the app names is outlined only where the view shows it.
    const index = indexOf(objects, untracked(this.hovered));
    const object = objects[index];
    if (!object || (inputs.overflow === 'clip' && !onPlot(inputs.plot, object.x, object.y))) {
      return -1;
    }
    return index;
  }

  /** Sets `hovered` when it changes, in the zone, so that an app's listener runs as any other. */
  private setHovered(id: NeatBevObjectId | null): void {
    if (untracked(this.hovered) === id) return;
    this.zone.run(() => this.hovered.set(id));
  }

  /** Reports where a mouse or pen is, meters, when that changed; null once it has gone. */
  private report(view: BevView): void {
    const pointer = this.hovering ? this.pointer : null;
    let point: NeatBevPoint | null = null;
    if (pointer && view.ppm > 0) {
      const { x, y } = toVehicle(view, pointer.x, pointer.y, this.vehiclePoint);
      point = { x, y };
    }
    const last = this.reported;
    if (point === last || (point && last && point.x === last.x && point.y === last.y)) return;
    this.reported = point;
    this.zone.run(() => this.pointerMove.emit(point));
  }

  /** The index of the object at `pointer` (CSS px), where the view shows objects; -1 for none. */
  private hitAt(
    view: BevView,
    inputs: BevInputs,
    frame: NeatBevFrame | null,
    pointer: { x: number; y: number },
  ): number {
    const objects = frame?.objects;
    if (!objects?.length || !(view.ppm > 0)) return -1;
    const at = toVehicle(view, pointer.x, pointer.y, this.vehiclePoint);
    if (inputs.overflow === 'clip' && !onPlot(inputs.plot, at.x, at.y)) return -1;
    return hitObject(objects, at.x, at.y, HIT_TOLERANCE_PX / (view.ppm * view.k));
  }
}

/** The index of the object `id` names: by its `id`, or by its index for objects without one. */
function indexOf(objects: readonly NeatBevObject[], id: NeatBevObjectId | null): number {
  if (id === null) return -1;
  const byId = objects.findIndex((object) => object.id === id);
  if (byId >= 0) return byId;
  return typeof id === 'number' && objects[id]?.id === undefined && id in objects ? id : -1;
}

function sameBounds(
  given: { width: number; height: number; pan: ScreenRect } | null,
  width: number,
  height: number,
  [[x0, y0], [x1, y1]]: ScreenRect,
): boolean {
  if (!given || given.width !== width || given.height !== height) return false;
  const [[a0, b0], [a1, b1]] = given.pan;
  return a0 === x0 && b0 === y0 && a1 === x1 && b1 === y1;
}

/** A color from 0..1 channels as CSS, opaque or see-through by `alpha`. */
function cssColor([red, green, blue]: NeatRgb, alpha = 1): string {
  const rgb = `${Math.round(red * 255)} ${Math.round(green * 255)} ${Math.round(blue * 255)}`;
  return alpha === 1 ? `rgb(${rgb})` : `rgb(${rgb} / ${alpha})`;
}
