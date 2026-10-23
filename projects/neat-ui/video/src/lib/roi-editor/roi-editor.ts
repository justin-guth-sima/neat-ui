import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  Renderer2,
  signal,
} from '@angular/core';
import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { OVERLAY_ROI_COLORS } from '../theme/overlay-palette';
import type { NeatVideoBox } from '../tile/video-tile';
import { NeatVideoTile } from '../tile/video-tile';

/** What a click does: nothing, or places points of an inclusion or an exclusion polygon. */
export type NeatRoiDrawMode = 'off' | 'inclusion' | 'exclusion';

type RoiPoint = NeatRoiPolygon['points'][number];

/** A click this close to the first point closes the polygon (CSS pixels, on the screen). */
const CLOSE_DISTANCE_PX = 10;
const MIN_POLYGON_POINTS = 3;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** The distance between two normalized points as the user sees it, so a wide image is not skewed. */
function distancePx(a: RoiPoint, b: RoiPoint, box: NeatVideoBox): number {
  return Math.hypot((a.x - b.x) * box.width, (a.y - b.y) * box.height);
}

function polylinePoints(points: readonly RoiPoint[], box: NeatVideoBox): string {
  return points.map((point) => `${point.x * box.width},${point.y * box.height}`).join(' ');
}

/**
 * Draws regions of interest on the image of the `neat-video-tile` it is placed in, and lets the
 * user add polygons by clicking points on it. Project it into the tile with `neatTileOverlay`:
 *
 * ```html
 * <neat-video-tile>
 *   <neat-roi-editor neatTileOverlay [regions]="regions" [mode]="mode" (regionsChange)="…" />
 * </neat-video-tile>
 * ```
 *
 * It sits on the tile's video box, so a point is a position on the image, not on the letterbox,
 * and it stays there when the tile resizes. Without a video box it draws nothing and takes no input.
 *
 * With a `mode` of `inclusion` or `exclusion`, each click adds a point. A click within 10 px of
 * the first point closes the polygon once it has three; so does a double-click. The second click
 * of a double-click (`detail` 2 or more) is ignored, so a double-click is its first click plus a
 * close. `regionsChange` emits when a polygon closes, with it appended to `regions`; the editor
 * never changes `regions` itself.
 * Escape cancels the open polygon, and so does a new `mode` or `regions` from outside, or the
 * image going away. Drawing is pointer-only: the polygon is open on the host, which takes focus
 * on the first point so Escape reaches it. An app offers the keyboard its own way to remove
 * regions.
 *
 * The open polygon lives in component signals: it changes per click, and the polyline follows the
 * pointer only while a polygon is open, so a pointer that moves over an idle editor costs no
 * change detection.
 */
@Component({
  selector: 'neat-roi-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Focus is only there so Escape arrives, so the host is out of the Tab order and only while a
    // polygon is open; the label names what has focus.
    '[attr.tabindex]': 'drawing() ? -1 : null',
    '[attr.role]': 'drawing() ? "group" : null',
    '[attr.aria-label]': 'drawing() ? "Region drawing surface" : null',
    // On the host, not the surface: drawing is pointer-only, and the lint rules for clicks on a
    // template element ask for a keyboard path that the app's region list provides instead.
    '(click)': 'onClick($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(keydown.escape)': 'cancelOnEscape($event)',
  },
  template: `
    @if (tileBox(); as box) {
      <svg
        class="surface"
        aria-hidden="true"
        [attr.data-mode]="mode()"
        [style.left.px]="box.x"
        [style.top.px]="box.y"
        [style.width.px]="box.width"
        [style.height.px]="box.height"
      >
        @for (region of placed(); track $index) {
          <polygon
            [attr.points]="region.points"
            [attr.fill]="region.fill"
            [attr.stroke]="region.stroke"
            stroke-width="2"
          />
        }
        @if (draft(); as open) {
          <polyline
            [attr.points]="open.line"
            [attr.stroke]="open.stroke"
            fill="none"
            stroke-width="2"
            stroke-dasharray="4 4"
          />
          <circle [attr.cx]="open.startX" [attr.cy]="open.startY" r="4" [attr.fill]="open.stroke" />
        }
      </svg>
    }
  `,
  styleUrl: './roi-editor.css',
})
export class NeatRoiEditor {
  /** The polygons to draw. Open polygons are not part of it until `regionsChange` brings them. */
  readonly regions = input.required<readonly NeatRoiPolygon[]>();
  /** What a click does; `off` leaves the tile to what is under the editor. */
  readonly mode = input<NeatRoiDrawMode>('off');
  /** The polygon a click just closed, appended to `regions` in a new array. */
  readonly regionsChange = output<readonly NeatRoiPolygon[]>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly tileBox = inject(NeatVideoTile).videoBox;

  /** Whether there is an image to draw on; the open polygon does not survive losing it. */
  private readonly hasBox = computed(() => this.tileBox() !== null);

  /**
   * The open polygon's points, normalized to the image. A box that only changes size leaves it
   * alone (that is why it is normalized); anything that changes what a click would mean, or what
   * the polygon is drawn among, starts over.
   */
  private readonly open = linkedSignal<
    { mode: NeatRoiDrawMode; regions: readonly NeatRoiPolygon[]; hasBox: boolean },
    readonly RoiPoint[]
  >({
    source: () => ({ mode: this.mode(), regions: this.regions(), hasBox: this.hasBox() }),
    computation: () => [],
  });
  /** The last place the pointer was, normalized; the open polyline runs to it. */
  private readonly pointer = signal<RoiPoint | null>(null);

  protected readonly drawing = computed(() => this.open().length > 0);

  protected readonly placed = computed(() => {
    const box = this.tileBox();
    if (box === null) return [];
    // Fewer than three points is no area; the canvas drawing skips those too.
    return this.regions()
      .filter((region) => region.points.length >= MIN_POLYGON_POINTS)
      .map((region) => ({
        points: polylinePoints(region.points, box),
        fill: OVERLAY_ROI_COLORS[region.type].fill,
        stroke: OVERLAY_ROI_COLORS[region.type].stroke,
      }));
  });

  protected readonly draft = computed(() => {
    const box = this.tileBox();
    const mode = this.mode();
    const points = this.open();
    if (box === null || mode === 'off' || points.length === 0) return null;
    const through = this.pointer() ?? points[points.length - 1];
    return {
      line: polylinePoints([...points, through], box),
      stroke: OVERLAY_ROI_COLORS[mode].stroke,
      startX: points[0].x * box.width,
      startY: points[0].y * box.height,
    };
  });

  constructor() {
    // Not a template listener: those schedule change detection on every event, and a pointer
    // passing over an idle editor must not.
    const stopListening = inject(Renderer2).listen(
      this.host.nativeElement,
      'pointermove',
      (event: MouseEvent) => {
        if (this.open().length === 0) return;
        const located = this.locate(event);
        if (located !== null) this.pointer.set(located.point);
      },
    );
    inject(DestroyRef).onDestroy(stopListening);
  }

  protected onClick(event: MouseEvent): void {
    const mode = this.mode();
    // The second click of a double-click: the first already placed its point or closed the
    // polygon, and `dblclick` follows to close. Counting it would stack a point on the first, or
    // open a polygon right after one closed.
    if (mode === 'off' || event.button !== 0 || event.detail >= 2) return;
    const located = this.locate(event);
    if (located === null) return;
    const { point, box } = located;
    const points = this.open();

    if (
      points.length >= MIN_POLYGON_POINTS &&
      distancePx(points[0], point, box) <= CLOSE_DISTANCE_PX
    ) {
      this.close(mode, points);
      return;
    }
    this.pointer.set(point);
    this.open.set([...points, point]);
    if (points.length === 0) {
      // After the render that makes the host focusable.
      afterNextRender(() => this.host.nativeElement.focus({ preventScroll: true }), {
        injector: this.injector,
      });
    }
  }

  protected onDoubleClick(event: MouseEvent): void {
    const mode = this.mode();
    if (mode === 'off' || event.button !== 0) return;
    // The clicks of the pair have placed their points (the second was ignored); close what is open.
    const points = this.open();
    if (points.length >= MIN_POLYGON_POINTS) this.close(mode, points);
  }

  protected cancelOnEscape(event: Event): void {
    // An Escape with nothing open belongs to whoever is around the editor (a dialog, a selection).
    if (this.open().length === 0) return;
    event.stopPropagation();
    this.open.set([]);
  }

  private close(mode: 'inclusion' | 'exclusion', points: readonly RoiPoint[]): void {
    this.open.set([]);
    this.regionsChange.emit([...this.regions(), { type: mode, points }]);
  }

  /**
   * Where the pointer is on the image, 0..1 on each axis and clamped, with the box it was
   * measured against; null without a box to measure. The host fills the tile's overlay layer, so
   * its corner is the tile's.
   */
  private locate(event: MouseEvent): { point: RoiPoint; box: NeatVideoBox } | null {
    const box = this.tileBox();
    if (box === null || box.width <= 0 || box.height <= 0) return null;
    const origin = this.host.nativeElement.getBoundingClientRect();
    return {
      point: {
        x: clamp01((event.clientX - origin.left - box.x) / box.width),
        y: clamp01((event.clientY - origin.top - box.y) / box.height),
      },
      box,
    };
  }
}
