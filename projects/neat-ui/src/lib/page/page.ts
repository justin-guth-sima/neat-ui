import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  NavigationSkipped,
  NavigationSkippedCode,
  Router,
  UrlTree,
} from '@angular/router';
import { reducedMotion } from '../motion/eased';
import { inPageLinkTarget, scrollToTarget } from './fragment';
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
 *
 * **Links to a section.** A navigation whose URL has a fragment scrolls the page to the element of
 * that id, in the body or the aside, once the page has rendered. The app turns nothing on:
 *
 * ```html
 * <a routerLink="/guide" fragment="setup">Set up</a>
 * <a href="#setup">Set up</a>
 * <h2 id="setup">Set up</h2>
 * ```
 *
 * The router's own `anchorScrolling` scrolls the window, which never scrolls in a kit app, so the
 * page does it. It scrolls only its own box, never what is around it. The element stops at the
 * box's inset (its `scroll-padding-top`), or as far below it as its own `scroll-margin-top` says.
 *
 * An in-page link (`href="#setup"`) becomes such a navigation, so it keeps the route and adds a
 * history entry. With hash routing (`HashLocationStrategy`) the page leaves it alone. A link to
 * the fragment the URL already has scrolls again. The scroll is smooth for a link on the page
 * and a jump when the page opens at a fragment, or for a user who asked for reduced motion. The
 * element must be there once the page has rendered: one that arrives later is not waited for.
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
      <div #body class="body" [attr.data-scroll]="scroll()" [attr.data-padding]="padding()">
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
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
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
    this.followFragments();
  }

  /**
   * Scrolls to the element a navigation's fragment names, and makes an in-page link
   * (`href="#id"`) such a navigation. Nothing without a router.
   */
  private followFragments(): void {
    const router = inject(Router, { optional: true });
    if (!router) return;
    const injector = inject(Injector);
    const changes = inject(ChangeDetectorRef);
    // The navigation that opens the page jumps, as a browser does when it loads at a fragment.
    let shown = false;
    afterNextRender(() => (shown = true));
    router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      // A link to the fragment the URL already has is skipped by the router; it scrolls again.
      const url =
        event instanceof NavigationEnd
          ? event.urlAfterRedirects
          : event instanceof NavigationSkipped &&
              event.code === NavigationSkippedCode.IgnoredSameUrlNavigation
            ? event.url
            : null;
      const id = url === null ? null : router.parseUrl(url).fragment;
      if (!id) return;
      const smooth = shown && !reducedMotion();
      // Once the navigation's views are drawn, so the element is there; a render is asked for,
      // since a navigation that only changes the fragment may change no view.
      afterNextRender(() => this.scrollToFragment(id, smooth), { injector });
      changes.markForCheck();
    });
    // With hash routing an `href="#…"` is a route, which the browser and the router follow.
    if (inject(LocationStrategy, { optional: true }) instanceof HashLocationStrategy) return;
    const onClick = (event: MouseEvent) => {
      const id = inPageLinkTarget(event, this.page);
      if (id === null) return;
      // Without this, the link would resolve against the document's base and leave the page.
      event.preventDefault();
      const current = router.parseUrl(router.url);
      void router.navigateByUrl(new UrlTree(current.root, current.queryParams, id));
    };
    this.page.addEventListener('click', onClick);
    inject(DestroyRef).onDestroy(() => this.page.removeEventListener('click', onClick));
  }

  /**
   * Scrolls the page's own box that holds the element `id` names, the body or the aside, to it. An
   * element of a page nested in this one is that page's to scroll to.
   */
  private scrollToFragment(id: string, smooth: boolean): void {
    const target = Array.from(this.page.querySelectorAll(`#${CSS.escape(id)}`)).find(
      (element) => element.closest('neat-page') === this.page,
    );
    if (!target) return;
    const boxes = [
      this.scroll() === 'body' ? this.body().nativeElement : null,
      this.panel()?.nativeElement,
    ];
    const box = boxes.find((candidate) => candidate?.contains(target));
    if (box) scrollToTarget(target, box, smooth);
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
