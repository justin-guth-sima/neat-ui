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
    super(
      'neat-ui: only one aside toggle at a time; remove the other neat-aside-toggle first.',
    );
  }
}

/**
 * The button that opens and closes the page's aside, which the shell draws at the top bar's
 * right edge, after the kiosk button and above the panel:
 *
 * ```html
 * <div *neatPageToolbar>…</div>
 * <neat-aside-toggle [(open)]="asideOpen" />
 * <neat-page [aside]="asideOpen() ? 'open' : 'closed'">…</neat-page>
 * ```
 *
 * The page declares it anywhere in its template except inside `*neatPageToolbar` (which throws in
 * dev mode: the toggle has a place of its own, and the toolbar's view is re-created by the shell);
 * it renders nothing where it is declared, and its button, a template of its own, goes to the
 * shell while the page exists, as the page toolbar does. On a narrow screen it is the last item of
 * the top bar's first row; in kiosk mode it floats with the page's tools, after them. One toggle
 * at a time; a second throws in dev mode.
 *
 * One look on every page: the top bar's edge control, as the kiosk button beside it (a large,
 * round, text, icon-only `neatButton`), with the `side-panel` icon (not `info`, which is left for
 * an information action), whose pressed state is the panel's. `label` names it and is its tooltip
 * ("Side panel" unless the page says otherwise). `open` is a model the page owns, so the page
 * decides where it is remembered; the toggle only flips it. `focus()` puts the focus on the button,
 * for a page whose panel closes from inside (Escape, a close button) and must not leave the focus
 * on nothing.
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
 * The column of an aside's content, on the element the page marks `neatPageAside` (or its
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
