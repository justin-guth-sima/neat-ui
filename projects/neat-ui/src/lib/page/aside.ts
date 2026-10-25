import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { NeatViewport } from './viewport';
import { NeatTooltip } from '../tooltip/tooltip';

/*
 * The parts of a page's side panel (`neat-page`'s aside) that every page draws the same way: the
 * toolbar button that opens and closes it, and the panel's column, title, section headings, action
 * rows and inline code. Class strings stay literals: Tailwind finds the classes the kit stylesheet
 * needs by reading them. Sizes and gaps come from the kit's scale only.
 */

/**
 * The toolbar button that opens and closes the page's side panel:
 *
 * ```html
 * <div *neatPageToolbar>
 *   …
 *   <neat-aside-toggle [(open)]="asideOpen" />
 * </div>
 * <neat-page [aside]="asideOpen() ? 'open' : 'closed'">…</neat-page>
 * ```
 *
 * One look on every page: a small, text, icon-only `neatButton` with the `side-panel` icon (not
 * `info`, which is left for an information action), whose pressed state is the panel's. `label`
 * names it and is its tooltip ("Side panel" unless the page says otherwise). `open` is a model the
 * page owns, so the page decides where it is remembered; the toggle only flips it. `focus()` puts
 * the focus on the button, for a page whose panel closes from inside (Escape, a close button) and
 * must not leave the focus on nothing.
 *
 * On a narrow screen (`NeatViewport`) the panel floats over the page and this button is the only
 * way to close it, so it leads the page's tools: the toolbar scrolls when its tools exceed the
 * phone's row, and the button must stay in view while the panel is open. It is drawn first but
 * stays last in the markup, so for this one button the visual order differs from the tab order.
 *
 * The page's toolbar is a template the shell renders elsewhere, outside `neat-page`, so the toggle
 * and the page meet in the page's own state, not through the kit.
 */
@Component({
  selector: 'neat-aside-toggle',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // No box of its own: the button is the toolbar's item.
  host: { class: 'contents' },
  template: `
    <button
      #button
      neatButton
      type="button"
      variant="text"
      size="small"
      iconOnly
      neatTooltipPosition="bottom"
      class="data-[narrow=true]:order-first"
      [attr.data-narrow]="viewport.narrow()"
      [attr.aria-label]="label()"
      [neatTooltip]="label()"
      [pressed]="open()"
      (click)="open.set(!open())"
    >
      <neat-icon name="side-panel" />
    </button>
  `,
})
export class NeatAsideToggle {
  /** The button's name and tooltip. */
  readonly label = input('Side panel');
  /** Whether the page's side panel is open. */
  readonly open = model(false);

  protected readonly viewport = inject(NeatViewport);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  /** Puts the focus on the button. */
  focus(): void {
    this.button().nativeElement.focus();
  }
}

/**
 * The column of a side panel's content, on the element the page marks `neatPageAside` (or its
 * root inside): its parts stacked one gap apart (`--neat-space-3`). The aside gives it its width,
 * inset and scrolling.
 */
@Directive({
  selector: '[neatAsidePanel]',
  host: { class: 'flex flex-col gap-(--neat-space-3)' },
})
export class NeatAsidePanel {}

/** What the panel is about, as its first line: `<h2 neatAsideTitle>src3</h2>`. */
@Directive({
  selector: '[neatAsideTitle]',
  host: { class: 'm-0 text-base font-medium' },
})
export class NeatAsideTitle {}

/**
 * The heading of a section of the panel: `<h3 neatAsideHeading>Source</h3>`. It sits nearer to the
 * section it names than to the one before (a gap above it on top of the panel's), except as the
 * panel's first part.
 */
@Directive({
  selector: '[neatAsideHeading]',
  host: {
    class: 'mb-0 mt-(--neat-space-3) first:mt-0 text-(length:--neat-text-sm) font-semibold',
  },
})
export class NeatAsideHeading {}

/** A row of the panel's buttons, which wraps when the panel is narrow. */
@Directive({
  selector: '[neatAsideActions]',
  host: { class: 'flex flex-wrap items-center gap-(--neat-space-2)' },
})
export class NeatAsideActions {}

/**
 * A URL, a path or a name in running text: `<code neatCode>rtsp://…/src3</code>`. Monospace runs
 * wide, so it is the kit's small size, and it has no spaces to break at, so it wraps anywhere.
 */
@Directive({
  selector: 'code[neatCode]',
  host: { class: 'text-(length:--neat-text-xs) wrap-anywhere' },
})
export class NeatCode {}
