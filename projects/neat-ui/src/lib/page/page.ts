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
 * The side panel's bounds and the keyboard step, stated here and nowhere else. The panel is at
 * least 18rem, so its content stays usable, and at most 48rem or 60 % of the page, so the body
 * keeps at least 40 % of it. They reach the stylesheet as pixels (`--neat-page-aside-min` and
 * `--neat-page-aside-max` on the aside), which is also where they are enforced.
 */
const MIN_REM = 18;
const MAX_REM = 48;
const MAX_SHARE = 0.6;
const KEY_STEP = 16;

/**
 * A page in the shell's content area. It fills its parent and owns at most one scroll context:
 * with `scroll="body"` (the default) its body is the single scroll container; with
 * `scroll="none"` nothing scrolls and the content sizes itself to the page (for example a grid
 * that fits the screen).
 *
 * With `padding="page"` (the default) the content keeps the kit's page inset from the content
 * area's edges, so every app's pages line up; `padding="none"` lets full-bleed content (a video
 * grid, a map) reach the edges.
 *
 * Elements marked `neatPageAside` form the page's side panel (an inspector, say), shown on the
 * right while `aside="open"`. The panel is `--neat-aside-width` wide and scrolls on its own; the
 * body narrows beside it rather than being covered, keeping its own scroll setting. The aside is
 * the one supported second scroll context of a page. Closed, the panel and its content are out
 * of the DOM, but projected content is still instantiated (content projection always creates
 * it): gate expensive content with an `@if` of your own.
 *
 * On a narrow screen (`NeatViewport`) the panel floats over the right of the page instead,
 * `--neat-aside-width` wide but never wider than the page, and the body keeps the whole width.
 * There is no scrim and no Escape handling: the page owns the open state, and the toolbar's
 * `neat-aside-toggle` closes it. A page that keeps its panel's state should use `neatAsideOpen`,
 * which starts the panel closed on a narrow screen without overwriting the choice remembered
 * for a wide one.
 *
 * Beside the body the panel can be resized: a separator on its inline-start edge is dragged with
 * a pointer, or moved with the arrow keys (left widens, 16 px a step), Home and End; a double
 * click returns to the default. `asideWidth` is the width in pixels, `null` for the default
 * `--neat-aside-width`. The page only exposes the model, so an app that wants the width kept
 * binds `[(asideWidth)]` and stores it where it likes; a drag writes it on release, a key press
 * at once. The panel is shown between 18rem and the smaller of 48rem and 60 % of the page; a
 * width outside that is shown clamped and the model left alone, so a remembered width returns
 * when the window is wide enough again.
 */
@Component({
  selector: 'neat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-aside]': "viewport.narrow() ? 'overlay' : 'beside'",
    '[attr.data-resizing]': "dragWidth() === null ? null : ''",
  },
  template: `
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
          (dblclick)="asideWidth.set(null)"
        ></div>
      }
      <aside
        #aside
        class="in-data-[aside=overlay]:shadow-md"
        [style.--neat-aside-width]="requested() === null ? null : requested() + 'px'"
        [style.--neat-page-aside-min]="viewport.narrow() ? null : bounds().min + 'px'"
        [style.--neat-page-aside-max]="viewport.narrow() ? null : bounds().max + 'px'"
      >
        <ng-content select="[neatPageAside]" />
      </aside>
    }
  `,
  styleUrl: './page.css',
})
export class NeatPage {
  protected readonly viewport = inject(NeatViewport);

  readonly scroll = input<'body' | 'none'>('body');
  readonly padding = input<'page' | 'none'>('page');
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
    const cap = MAX_REM * rem;
    const page = this.pageWidth();
    const max = page > 0 ? Math.min(cap, page * MAX_SHARE) : cap;
    // On a page too small for both, the minimum wins: a panel cannot be narrower than its content.
    return { min, max: Math.max(min, Math.floor(max)) };
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
      if (!panel || typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(() => this.measure(panel));
      observer.observe(this.page);
      observer.observe(panel);
      onCleanup(() => observer.disconnect());
    });
  }

  protected step(event: KeyboardEvent): void {
    const { min, max } = this.bounds();
    const current = this.width() ?? min;
    const next = {
      ArrowLeft: current + KEY_STEP,
      ArrowRight: current - KEY_STEP,
      Home: min,
      End: max,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const width = this.clamp(next);
    if (width !== current) this.asideWidth.set(width);
  }

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    const width = this.width() ?? this.bounds().min;
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

  private clamp(width: number): number {
    const { min, max } = this.bounds();
    return Math.round(Math.min(max, Math.max(min, width)));
  }

  private measure(panel: HTMLElement): void {
    this.pageWidth.set(this.page.clientWidth);
    this.panelWidth.set(panel.offsetWidth);
    const fontSize = getComputedStyle(this.page.ownerDocument.documentElement).fontSize;
    this.rem.set(parseFloat(fontSize) || 16);
  }
}
