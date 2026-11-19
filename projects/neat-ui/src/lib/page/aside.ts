import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injectable,
  input,
  isDevMode,
  model,
  OnInit,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { NeatButton } from '../button/button';
import { NeatIcon } from '../icon/icon';
import { IN_PAGE_TOOLBAR } from '../shell/page-toolbar';
import { ShellSlot } from '../shell/shell-slot';
import { NeatTooltip } from '../tooltip/tooltip';

/*
 * The parts of a page's aside (`neat-page`'s aside) that every page draws the same way: the
 * top-bar button that opens and closes it, and the panel's column, title, section headings, action
 * rows and inline code. Class strings stay literals: Tailwind finds the classes the kit stylesheet
 * needs by reading them. Sizes and gaps come from the kit's scale only.
 */

/**
 * Where the active page's aside toggle is handed to the shell, which draws it at the top
 * bar's right edge (or in kiosk mode's floating bar). Internal to the kit: pages declare
 * `neat-aside-toggle`, the shell renders `portal`.
 */
@Injectable({ providedIn: 'root' })
export class AsideToggleSlot extends ShellSlot {
  constructor() {
    super('neat-ui: only one aside toggle at a time; remove the other neat-aside-toggle first.');
  }
}

/**
 * The button that opens and closes the page's aside, at the right edge of the top bar.
 *
 * ```html
 * <div *neatPageToolbar>…</div>
 * <neat-aside-toggle [(open)]="asideOpen" />
 * <neat-page [aside]="asideOpen() ? 'open' : 'closed'">…</neat-page>
 * ```
 *
 * The shell draws it after the kiosk button, above the panel. On a narrow screen it is the last
 * item of the top bar's first row. In kiosk mode it floats with the page's tools, after them.
 *
 * The page declares it anywhere in its template except inside `*neatPageToolbar`, which throws in
 * dev mode. The toggle has a place of its own, and the shell re-creates the toolbar's view. It
 * renders nothing where it is declared. Its button, a template of its own, goes to the shell while
 * the page exists, as the page toolbar does. One toggle at a time: a second throws in dev mode.
 *
 * It has one look on every page: the top bar's edge control, as the kiosk button beside it. That
 * is a large, round, text, icon-only `neatButton`, with the `side-panel` icon. The `info` icon is
 * left for an information action. Its pressed state is the panel's.
 *
 * `label` names it and is its tooltip: "Side panel" unless the page says otherwise. `open` is a
 * model the page owns, so the page decides where it is remembered. The toggle only flips it.
 *
 * `focus()` puts the focus on the button. It is for a page whose panel closes from inside, by
 * Escape or a close button, and must not leave the focus on nothing.
 */
@Component({
  selector: 'neat-aside-toggle',
  imports: [NeatButton, NeatIcon, NeatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Nothing is drawn where the page declares it, so it takes no box (or gap) there.
  host: { hidden: '' },
  template: `
    <ng-template #toggle>
      <button
        #button
        neatButton
        type="button"
        variant="text"
        size="large"
        rounded
        iconOnly
        neatTooltipPosition="bottom"
        [attr.aria-label]="label()"
        [neatTooltip]="label()"
        [pressed]="open()"
        (click)="open.set(!open())"
      >
        <neat-icon name="side-panel" />
      </button>
    </ng-template>
  `,
})
export class NeatAsideToggle implements OnInit {
  /** The button's name and tooltip. */
  readonly label = input('Side panel');
  /** Whether the page's aside is open. */
  readonly open = model(false);

  private readonly slot = inject(AsideToggleSlot);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly template = viewChild.required('toggle', { read: TemplateRef });
  // The button is drawn by the shell, yet it comes from this component's template, so the query
  // finds it where it is rendered.
  private readonly button = viewChild<ElementRef<HTMLButtonElement>>('button');

  constructor() {
    if (isDevMode() && inject(IN_PAGE_TOOLBAR)) {
      throw new Error(
        'neat-ui: declare neat-aside-toggle outside *neatPageToolbar; the shell draws it at the ' +
          "top bar's right edge.",
      );
    }
  }

  ngOnInit(): void {
    const portal = new TemplatePortal(this.template(), this.viewContainer);
    this.slot.register(portal);
    this.destroyRef.onDestroy(() => this.slot.unregister(portal));
  }

  /** Puts the focus on the button. */
  focus(): void {
    this.button()?.nativeElement.focus();
  }
}

/**
 * The column of an aside's content: its parts stacked one gap apart.
 *
 * ```html
 * <section neatPageAside neatAsidePanel>
 *   <h2 neatAsideTitle>Inspector</h2>
 *   <p>…</p>
 * </section>
 * ```
 *
 * Put it on the element marked `neatPageAside`, or on that element's root inside. The gap is
 * `--neat-space-3`. The aside gives the column its width, inset and scrolling.
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
 * The heading of a section of the panel.
 *
 * ```html
 * <h3 neatAsideHeading>Source</h3>
 * ```
 *
 * It sits nearer to the section it names than to the one before, with a gap above it on top of the
 * panel's. As the panel's first part, it has no such gap.
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
 *
 * Inside `neatProse`, a plain `code` takes the same size and wrapping, on a chip.
 */
// `neat-code` is the kit's one look for inline code, which `neatProse` shares (prose.css).
@Directive({
  selector: 'code[neatCode]',
  host: { class: 'neat-code' },
})
export class NeatCode {}
