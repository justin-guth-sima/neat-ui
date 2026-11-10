import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { NeatViewport } from './viewport';

/*
 * The aside's bounds and the keyboard step, stated here and nowhere else. The panel is at
 * least 18rem, so its content stays usable, and at most what leaves the body 20rem: there is no
 * other cap, since a wide screen is the reason to widen the panel (a table of columns, say) and a
 * share of the page or a fixed width would stop it short. On a page too small for both the
 * minimum wins. They reach the stylesheet as pixels (`--neat-page-aside-min` and
 * `--neat-page-aside-max` on the aside), which is also where they are enforced.
 */
const MIN_REM = 18;
const BODY_MIN_REM = 20;
const KEY_STEP = 16;

/**
 * A page in the shell's content area: it fills the area and owns at most one scroll context.
 *
 * ```html
 * <neat-page>
 *   <app-recordings />
 * </neat-page>
 * ```
 *
 * With `scroll="body"` (the default) its body is the single scroll container. With
 * `scroll="none"` nothing scrolls, and the content sizes itself to the page, such as a grid that
 * fits the screen.
 *
 * The content takes its size from the page, and never measures the shell or sets a height. So the
 * same page works in a small window, on a wall display and in kiosk mode, where the rail and the
 * top bar are gone and the page gets the whole viewport.
 *
 * With `padding="page"` (the default), the content keeps the kit's page inset from the content
 * area's edges, so every app's pages line up. `padding="none"` lets full-bleed content, such as a
 * video grid or a map, reach the edges.
 *
 * **The page nav.** A `nav[neatPageNav]` (see `NeatPageNav`) as a direct child is the page nav.
 * It is the body's start column, as high as the page, with the aside at the other end. It scrolls
 * on its own, whatever `scroll` says. On a narrow screen it is a closed section above the body,
 * under which the floating panel opens. Without one, the body starts at the page's edge.
 *
 * **The aside.** Elements marked `neatPageAside` form the page's aside, such as an inspector. It
 * shows on the right while `aside="open"`. The panel is `--neat-aside-width` wide and scrolls on
 * its own. The body narrows beside it rather than being covered, and keeps its own scroll setting.
 *
 * The aside and the page nav are a page's supported other scroll contexts. A page that needs
 * another region of its own that scrolls independently is a kit change. So the layout becomes a
 * supported component, not a workaround.
 *
 * Closed, the panel and its content are out of the DOM. Projected content is still instantiated,
 * though, since content projection always creates it. Gate expensive content with an `@if` of your
 * own.
 *
 * On a narrow screen (`NeatViewport`), the panel floats over the right of the page instead. It is
 * `--neat-aside-width` wide, but never wider than the page, and the body keeps the whole width.
 *
 * There is no scrim and no Escape handling: the page owns the open state, and the toolbar's
 * `neat-aside-toggle` closes it. A page that keeps its panel's state should use `neatAsideOpen`.
 * It starts the panel closed on a narrow screen, without overwriting the choice remembered for a
 * wide one.
 *
 * **Resizing.** Beside the body, the panel can be resized by a separator on its inline-start edge:
 * - Drag it with a pointer.
 * - Move it with the arrow keys, 16 px a step, left widening. Home and End go to the bounds.
 * - Double-click it to return to the default.
 *
 * `asideWidth` is the width in pixels, `null` for the default `--neat-aside-width`. The page only
 * exposes the model. So an app that wants the width kept binds `[(asideWidth)]`, and stores it
 * where it likes. A drag writes it on release, a key press at once.
 *
 * The panel is shown between 18rem and the page's width less 20rem, which leaves the body 20rem. A
 * width outside that is shown clamped, and the model left alone. So a remembered width returns when
 * the window is wide enough again.
 */
@Component({
  selector: 'neat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-aside]': "viewport.narrow() ? 'overlay' : 'beside'",
    '[attr.data-nav]': "viewport.narrow() ? 'above' : 'beside'",
    '[attr.data-resizing]': "dragWidth() === null ? null : ''",
  },
  template: `
    <ng-content select="[neatPageNav]" />
    <div class="content">
      <div class="body" [attr.data-scroll]="scroll()" [attr.data-padding]="padding()">
        <ng-content />
      </div>
      @if (aside() === 'open') {
        @if (!viewport.narrow()) {
          <div
            class="separator"
            role="separator"
            tabindex="0"
            aria-orientation="vertical"
            aria-label="Resize side panel"
            [attr.aria-valuemin]="bounds().min"
            [attr.aria-valuemax]="bounds().max"
            [attr.aria-valuenow]="width()"
            [attr.aria-valuetext]="width() === null ? null : width() + ' px'"
            (keydown)="step($event)"
            (pointerdown)="startDrag($event)"
            (pointermove)="drag($event)"
            (pointerup)="endDrag()"
            (pointercancel)="cancelDrag()"
            (lostpointercapture)="cancelDrag()"
            (dblclick)="asideWidth.set(null)"
          ></div>
        }
        <aside
          #aside
          class="in-data-[aside=overlay]:shadow-md"
          [style.--neat-aside-width]="requested() === null ? null : requested() + 'px'"
          [style.--neat-page-aside-min]="viewport.narrow() ? null : bounds().min + 'px'"
          [style.--neat-page-aside-max]="
            viewport.narrow() || bounds().max === null ? null : bounds().max + 'px'
          "
        >
          <ng-content select="[neatPageAside]" />
        </aside>
      }
    </div>
  `,
  styleUrl: './page.css',
})
export class NeatPage {
  protected readonly viewport = inject(NeatViewport);

  /**
   * Which part scrolls: `body` (the default) makes the body the page's one scroll container;
   * `none` clips it, for content that sizes itself to the page.
   */
  readonly scroll = input<'body' | 'none'>('body');
  /**
   * The inset around the content: `page` (the default) keeps the kit's page padding, which scrolls
   * with the content; `none` lets full-bleed content reach the edges.
   */
  readonly padding = input<'page' | 'none'>('page');
  /**
   * Whether the aside (the elements marked `neatPageAside`) is shown: `closed` (the default)
   * or `open`. The page owns no state: bind it to yours, or to `neatAsideOpen`.
   */
  readonly aside = input<'open' | 'closed'>('closed');
  /** The panel's width in pixels, `null` for the default `--neat-aside-width`. */
  readonly asideWidth = model<number | null>(null);

  private readonly page = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly panel = viewChild<ElementRef<HTMLElement>>('aside');

  // What the browser laid out, which only it knows: the page's width, the panel's, and what a rem
  // is. Zero means not measured yet.
  private readonly pageWidth = signal(0);
  private readonly panelWidth = signal(0);
  private readonly rem = signal(16);

  /** The width a drag in progress asks for, until the pointer is released. */
  protected readonly dragWidth = signal<number | null>(null);
  private dragStart: { x: number; width: number; moved: boolean } | null = null;

  protected readonly bounds = computed(() => {
    const rem = this.rem();
    const min = Math.round(MIN_REM * rem);
    const page = this.pageWidth();
    // On a page too small for both, the minimum wins: a panel cannot be narrower than its content.
    // Until the page is measured there is no maximum to state (`null`): the panel is bounded by
    // the page itself, and the observer's first report, before anything is painted, replaces it.
    const max = page > 0 ? Math.max(min, Math.floor(page - BODY_MIN_REM * rem)) : null;
    return { min, max };
  });

  /** The width asked for, by a drag or the model; `null` when the default applies. */
  protected readonly requested = computed(() =>
    this.viewport.narrow() ? null : (this.dragWidth() ?? this.asideWidth()),
  );

  /** The width the separator announces: what was asked for, clamped, or the default as laid out. */
  protected readonly width = computed<number | null>(() => {
    const wanted = this.requested() ?? (this.panelWidth() > 0 ? this.panelWidth() : null);
    return wanted === null ? null : this.clamp(wanted);
  });

  constructor() {
    effect((onCleanup) => {
      const panel = this.panel()?.nativeElement;
      const narrow = this.viewport.narrow();
      // The handle is gone when the panel closes or the screen turns narrow, and takes its pointer
      // events with it: a drag in progress would otherwise never end.
      onCleanup(() => this.cancelDrag());
      // Nothing to measure for a panel that floats over the page at its own width.
      if (!panel || narrow || typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(() => this.measure(panel));
      observer.observe(this.page);
      observer.observe(panel);
      onCleanup(() => observer.disconnect());
    });
  }

  protected step(event: KeyboardEvent): void {
    const { min, max } = this.bounds();
    const current = this.current();
    const next = {
      ArrowLeft: current + KEY_STEP,
      ArrowRight: current - KEY_STEP,
      Home: min,
      End: max ?? current,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const width = this.clamp(next);
    if (width !== current) this.asideWidth.set(width);
  }

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const width = this.current();
    this.dragStart = { x: event.clientX, width, moved: false };
    this.dragWidth.set(width);
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragStart) return;
    // The panel is on the right, so a pointer moving left widens it.
    this.dragStart.moved = true;
    this.dragWidth.set(this.clamp(this.dragStart.width + this.dragStart.x - event.clientX));
  }

  protected endDrag(): void {
    const width = this.dragWidth();
    const moved = this.dragStart?.moved;
    this.cancelDrag();
    // A click that moved nothing leaves the model, which may be the default, as it was.
    if (moved && width !== null) this.asideWidth.set(width);
  }

  protected cancelDrag(): void {
    this.dragStart = null;
    this.dragWidth.set(null);
  }

  /** The width now, from the panel itself while the observer has not reported yet. */
  private current(): number {
    return this.width() ?? this.clamp(this.panel()?.nativeElement.offsetWidth || this.bounds().min);
  }

  private clamp(width: number): number {
    const { min, max } = this.bounds();
    return Math.round(Math.min(max ?? Infinity, Math.max(min, width)));
  }

  private measure(panel: HTMLElement): void {
    this.pageWidth.set(this.page.clientWidth);
    this.panelWidth.set(panel.offsetWidth);
    const fontSize = getComputedStyle(this.page.ownerDocument.documentElement).fontSize;
    this.rem.set(parseFloat(fontSize) || 16);
  }
}
