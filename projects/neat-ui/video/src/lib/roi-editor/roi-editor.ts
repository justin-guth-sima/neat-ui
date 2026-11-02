import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  NgZone,
  output,
  Renderer2,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import type { NeatRoiPolygon } from '../overlays/overlay-settings';
import { OVERLAY_ROI_COLORS } from '../theme/overlay-palette';
import { neatRoiNames } from './roi-names';
import type { NeatVideoBox } from '../tile/video-tile';
import { NeatVideoTile } from '../tile/video-tile';

/** What a click does: nothing, or places points of an inclusion or an exclusion polygon. */
export type NeatRoiDrawMode = 'off' | 'inclusion' | 'exclusion';

type RoiPoint = NeatRoiPolygon['points'][number];

/** Which box the editor draws on: the image while the tile plays, else the whole tile. */
type BoxSource = 'video' | 'tile' | null;

/** The editor's own size, in CSS pixels. */
interface Size {
  readonly width: number;
  readonly height: number;
}

/** The Delete bubble: the region it is for and where it opened, in CSS pixels from the corner. */
interface RoiMenu {
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

/** A click this close to the first point closes the polygon (CSS pixels, on the screen). */
const CLOSE_DISTANCE_PX = 10;
const MIN_POLYGON_POINTS = 3;
const STROKE_WIDTH = 2;
const HIGHLIGHT_STROKE_WIDTH = 3;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** `start` moved back as far as needed for `length` to end by `limit`, but never below 0. */
function fitInto(start: number, length: number, limit: number): number {
  return Math.max(0, Math.min(start, limit - length));
}

function sameSize(a: Size | null, b: Size | null): boolean {
  if (a === null || b === null) return a === b;
  return a.width === b.width && a.height === b.height;
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
 *   <neat-roi-editor
 *     neatTileOverlay
 *     [regions]="regions"
 *     [mode]="mode"
 *     [(highlighted)]="highlighted"
 *     (regionsChange)="…"
 *   />
 * </neat-video-tile>
 * ```
 *
 * While the tile plays, it sits on the tile's video box, so a point is a position on the image,
 * not on the letterbox, and it stays there when the tile resizes. Without video (none yet, or
 * stopped) it uses the tile's full box instead, so regions can be seen and drawn before a stream
 * plays; points are normalized to whichever box was used, which is exact for a stream of the
 * tile's shape. Until it knows either box it draws nothing and takes no input. The full box is
 * meant for a tile with `bars` off: with bars on, the no-video note and the bar paint above the
 * editor and cover what lies under them.
 *
 * With a `mode` of `inclusion` or `exclusion`, each click adds a point. A click within 10 px of
 * the first point closes the polygon once it has three; so does a double-click. The second click
 * of a double-click (`detail` 2 or more) is ignored, so a double-click is its first click plus a
 * close. `regionsChange` emits when a polygon closes, with it appended to `regions`; the editor
 * never changes `regions` itself.
 * A right-click or Backspace removes the open polygon's last point, and the polygon with its only
 * point. Escape cancels the whole polygon, and so does a new `mode` or `regions` from outside, or
 * the box it is drawn on changing between the image and the tile. Drawing is pointer-only: the
 * polygon is open on the host, which takes focus on the first point so Backspace and Escape reach
 * it.
 *
 * In every mode, `off` included, the regions themselves take the pointer:
 * - Hovering one sets `highlighted` to its index in `regions` (where regions overlap, the one
 *   drawn last, on top), and leaving it sets null. An app binds the same index to its region list,
 *   so either side can highlight; a highlighted region has a stronger fill and outline.
 * - A right-click on one, while no polygon is open, opens a small bubble there with a Delete
 *   button, which emits
 *   `regionsChange` without that region. The button takes focus; Escape, a press outside the
 *   bubble, focus leaving it or new `regions` close it. It is a shortcut for the pointer: an app
 *   still offers the keyboard its own way to remove regions, such as its list.
 * Elsewhere the editor leaves mode `off` to what is under it.
 *
 * The open polygon lives in component signals: it changes per click, and the polyline follows the
 * pointer only while a polygon is open, so a pointer that moves over an idle editor costs no
 * change detection beyond entering and leaving a region.
 */
@Component({
  selector: 'neat-roi-editor',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Focus is only there so Backspace and Escape arrive, so the host is out of the Tab order and only while a
    // polygon is open; the label names what has focus.
    '[attr.tabindex]': 'drawing() ? -1 : null',
    '[attr.role]': 'drawing() ? "group" : null',
    '[attr.aria-label]': 'drawing() ? "Region drawing surface" : null',
    // On the host, not the surface: drawing is pointer-only, and the lint rules for clicks on a
    // template element ask for a keyboard path that the app's region list provides instead.
    '(click)': 'onClick($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(keydown.escape)': 'cancelOnEscape($event)',
    '(keydown.backspace)': 'undoOnBackspace($event)',
    // Also receives the right-click of a region, which `openMenu` leaves to it while drawing.
    '(contextmenu)': 'undoOnRightClick($event)',
  },
  template: `
    @if (box(); as box) {
      <svg
        class="surface"
        aria-hidden="true"
        [attr.data-mode]="mode()"
        [style.left.px]="box.x"
        [style.top.px]="box.y"
        [style.width.px]="box.width"
        [style.height.px]="box.height"
      >
        @for (region of placed(); track region.index) {
          <polygon
            class="region"
            [attr.points]="region.points"
            [attr.fill]="region.fill"
            [attr.stroke]="region.stroke"
            [attr.stroke-width]="region.strokeWidth"
            (pointerenter)="highlighted.set(region.index)"
            (pointerleave)="highlighted.set(null)"
            (contextmenu)="openMenu($event, region.index)"
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
      @if (menuLabel(); as label) {
        <!-- A press on the card around the button must not take focus from it: focus would fall
             to the page, and Escape would no longer reach the bubble. Focus moves on mousedown,
             which browsers also send after a touch. -->
        <div #menu class="menu" (mousedown)="$event.preventDefault()">
          <button
            neatButton
            variant="text"
            size="small"
            type="button"
            [attr.aria-label]="label"
            (click)="deleteFromMenu()"
            (keydown.escape)="closeMenuOnEscape($event)"
            (focusout)="closeMenuOnFocusOut($event)"
          >
            Delete
          </button>
        </div>
      }
    }
  `,
  styleUrl: './roi-editor.css',
})
export class NeatRoiEditor {
  /** The polygons to draw. Open polygons are not part of it until `regionsChange` brings them. */
  readonly regions = input.required<readonly NeatRoiPolygon[]>();
  /** What a click does; `off` leaves the tile to what is under the editor, but for the regions. */
  readonly mode = input<NeatRoiDrawMode>('off');
  /** A closed polygon appended to `regions`, or `regions` without a deleted one, in a new array. */
  readonly regionsChange = output<readonly NeatRoiPolygon[]>();
  /** The index in `regions` of the region to highlight, as the pointer or the app set it. */
  readonly highlighted = model<number | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly renderer = inject(Renderer2);
  private readonly document = inject(DOCUMENT);
  private readonly videoBox = inject(NeatVideoTile).videoBox;
  private readonly menuElement = viewChild<ElementRef<HTMLElement>>('menu');

  /**
   * The editor's own size, which is the tile's: its host fills the tile's overlay layer. Measured
   * here rather than asked of the tile because it is exactly the area whose clicks `locate` maps,
   * and the tile keeps its own measure in a plain field for its frame loop, not in a signal.
   */
  private readonly size = signal<Size | null>(null, { equal: sameSize });

  private readonly boxSource = computed<BoxSource>(() => {
    if (this.videoBox() !== null) return 'video';
    return this.size() === null ? null : 'tile';
  });

  protected readonly box = computed<NeatVideoBox | null>(() => {
    const video = this.videoBox();
    if (video !== null) return video;
    const size = this.size();
    return size === null ? null : { x: 0, y: 0, width: size.width, height: size.height };
  });

  /**
   * The open polygon's points, normalized to the box. A box that only changes size leaves it
   * alone (that is why it is normalized); anything that changes what a click would mean, or what
   * the polygon is drawn among, starts over.
   */
  private readonly open = linkedSignal<
    { mode: NeatRoiDrawMode; regions: readonly NeatRoiPolygon[]; boxSource: BoxSource },
    readonly RoiPoint[]
  >({
    source: () => ({ mode: this.mode(), regions: this.regions(), boxSource: this.boxSource() }),
    computation: () => [],
  });
  /** The last place the pointer was, normalized; the open polyline runs to it. */
  private readonly pointer = signal<RoiPoint | null>(null);

  /**
   * The open Delete bubble. New regions close it, since its index may name another region by
   * then, and so does a change of box, which moves the region it was opened on.
   */
  private readonly menu = linkedSignal<
    { regions: readonly NeatRoiPolygon[]; boxSource: BoxSource },
    RoiMenu | null
  >({
    source: () => ({ regions: this.regions(), boxSource: this.boxSource() }),
    computation: () => null,
  });
  /** What had focus when the bubble opened, given focus back when Escape or Delete closes it. */
  private focusBeforeMenu: HTMLElement | null = null;

  protected readonly drawing = computed(() => this.open().length > 0);

  protected readonly placed = computed(() => {
    const box = this.box();
    if (box === null) return [];
    const highlighted = this.highlighted();
    return (
      this.regions()
        .map((region, index) => ({ region, index }))
        // Fewer than three points is no area; the canvas drawing skips those too.
        .filter(({ region }) => region.points.length >= MIN_POLYGON_POINTS)
        .map(({ region, index }) => {
          const colors = OVERLAY_ROI_COLORS[region.type];
          const active = index === highlighted;
          return {
            index,
            points: polylinePoints(region.points, box),
            fill: active ? colors.fillActive : colors.fill,
            stroke: colors.stroke,
            strokeWidth: active ? HIGHLIGHT_STROKE_WIDTH : STROKE_WIDTH,
          };
        })
    );
  });

  protected readonly draft = computed(() => {
    const box = this.box();
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

  /**
   * The Delete button's name, the region named as an app's list names it: "Delete Inclusion 2".
   * None for an index past the list, which `openMenu` already refuses.
   */
  protected readonly menuLabel = computed(() => {
    const menu = this.menu();
    if (menu === null) return null;
    const name = neatRoiNames(this.regions())[menu.index];
    return name === undefined ? null : `Delete ${name}`;
  });

  constructor() {
    const host = this.host.nativeElement;
    const destroyRef = inject(DestroyRef);

    // Not a template listener: those schedule change detection on every event, and a pointer
    // passing over an idle editor must not.
    const stopListening = this.renderer.listen(host, 'pointermove', (event: MouseEvent) => {
      if (this.open().length === 0) return;
      const located = this.locate(event);
      if (located !== null) this.pointer.set(located.point);
    });
    destroyRef.onDestroy(stopListening);

    // Outside Angular, as the tile's own observer: it writes the size signal, only on a resize.
    const zone = inject(NgZone);
    afterNextRender(() => {
      const observer = zone.runOutsideAngular(
        () =>
          new ResizeObserver((entries) => {
            const { width, height } = entries[entries.length - 1].contentRect;
            this.size.set(width > 0 && height > 0 ? { width, height } : null);
          }),
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });

    // A press anywhere but on the bubble closes it; listened for only while it is open. Capture,
    // so content that stops the press on its way up still closes it.
    effect((onCleanup) => {
      if (this.menu() === null) return;
      onCleanup(
        this.renderer.listen(
          this.document,
          'pointerdown',
          (event: Event) => {
            // Focus goes where the press puts it.
            if (!this.inMenu(event.target)) this.closeMenu(false);
          },
          { capture: true },
        ),
      );
    });
  }

  protected onClick(event: MouseEvent): void {
    const mode = this.mode();
    // The second click of a double-click: the first already placed its point or closed the
    // polygon, and `dblclick` follows to close. Counting it would stack a point on the first, or
    // open a polygon right after one closed.
    if (mode === 'off' || event.button !== 0 || event.detail >= 2) return;
    // A click on the bubble is for its button, not a point on the image under it.
    if (this.inMenu(event.target)) return;
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
    if (mode === 'off' || event.button !== 0 || this.inMenu(event.target)) return;
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

  protected undoOnBackspace(event: Event): void {
    // A Backspace with nothing open is the page's, such as a field's or a shortcut's.
    if (this.open().length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.undoPoint();
  }

  protected undoOnRightClick(event: MouseEvent): void {
    // Without an open polygon the right-click is a region's (its own handler opens the bubble) or
    // the browser's.
    if (this.open().length === 0) return;
    event.preventDefault();
    this.undoPoint();
  }

  /** Opens the Delete bubble for the region at `index` at the pointer, instead of the browser's. */
  protected openMenu(event: MouseEvent, index: number): void {
    event.preventDefault();
    // An open polygon takes the right-click as an undo, from the host it bubbles to.
    if (this.open().length > 0) return;
    // The index is from the last render: a right-click that arrives after `regions` shrank and
    // before the next render names a region that is gone.
    if (index >= this.regions().length) return;
    const origin = this.host.nativeElement.getBoundingClientRect();
    const active = this.document.activeElement;
    this.focusBeforeMenu = active instanceof HTMLElement ? active : null;
    const menu: RoiMenu = { index, x: event.clientX - origin.left, y: event.clientY - origin.top };
    this.menu.set(menu);
    // Placed by hand once it has rendered: keeping it inside the tile needs its own size. Not a
    // style binding, so a later render does not put it back at the pointer.
    afterNextRender(() => this.placeMenu(menu), { injector: this.injector });
  }

  protected deleteFromMenu(): void {
    const menu = this.menu();
    if (menu === null) return;
    // The region goes, and with it the element the pointer was on, which then sends no leave.
    if (this.highlighted() === menu.index) this.highlighted.set(null);
    this.closeMenu(true);
    this.regionsChange.emit(this.regions().filter((_, index) => index !== menu.index));
  }

  protected closeMenuOnEscape(event: Event): void {
    // The bubble's Escape: not the open polygon's, and not whatever is around the editor.
    event.stopPropagation();
    this.closeMenu(true);
  }

  protected closeMenuOnFocusOut(event: FocusEvent): void {
    // No related target is the window losing focus, not the user leaving the bubble.
    if (event.relatedTarget === null || this.inMenu(event.relatedTarget)) return;
    this.closeMenu(false);
  }

  /** Closes the bubble; `restoreFocus` when focus was in it and would otherwise fall to the page. */
  private closeMenu(restoreFocus: boolean): void {
    this.menu.set(null);
    const previous = this.focusBeforeMenu;
    this.focusBeforeMenu = null;
    if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
  }

  /** Moves the bubble in from the tile's edges as far as its size needs, and focuses Delete. */
  private placeMenu(menu: RoiMenu): void {
    const element = this.menuElement()?.nativeElement;
    if (element === undefined || this.menu() !== menu) return;
    const size = this.size();
    const x = size === null ? menu.x : fitInto(menu.x, element.offsetWidth, size.width);
    const y = size === null ? menu.y : fitInto(menu.y, element.offsetHeight, size.height);
    this.renderer.setStyle(element, 'left', `${x}px`);
    this.renderer.setStyle(element, 'top', `${y}px`);
    element.querySelector('button')?.focus({ preventScroll: true });
  }

  private inMenu(target: EventTarget | null): boolean {
    const element = this.menuElement()?.nativeElement;
    return element !== undefined && target instanceof Node && element.contains(target);
  }

  /** Drops the open polygon's last point; the polygon is gone with its only one. */
  private undoPoint(): void {
    this.open.update((points) => points.slice(0, -1));
  }

  private close(mode: 'inclusion' | 'exclusion', points: readonly RoiPoint[]): void {
    this.open.set([]);
    this.regionsChange.emit([...this.regions(), { type: mode, points }]);
  }

  /**
   * Where the pointer is on the box, 0..1 on each axis and clamped, with the box it was measured
   * against; null without a box to measure. The host fills the tile's overlay layer, so its corner
   * is the tile's.
   */
  private locate(event: MouseEvent): { point: RoiPoint; box: NeatVideoBox } | null {
    const box = this.box();
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
