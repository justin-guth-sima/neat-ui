import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  TemplateRef,
  untracked,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  BrnPopover,
  BrnPopoverContent,
  provideBrnPopoverConfig,
  provideBrnPopoverDefaultOptions,
} from '@spartan-ng/brain/popover';
import {
  KioskService,
  ɵhlm as hlm,
  ɵIN_PAGE_TOOLBAR as IN_PAGE_TOOLBAR,
  ɵOverlayFocus as OverlayFocus,
  ɵPANEL_SURFACE_CLASSES as PANEL_SURFACE_CLASSES,
  ɵPOPOVER_HELM_CLASSES as HELM_CLASSES,
} from '@sima/neat-ui';

/** Which edge of the trigger the panel lines up with: its `start`, its `center` or its `end`. */
export type NeatPopoverAlign = 'start' | 'center' | 'end';

/**
 * Helm's popover classes, re-exported for popover.spec's drift check; the primary keeps them with
 * the surface `neat-popover` shares with the collapsed rail's menu.
 */
export const POPOVER_HELM_CLASSES = HELM_CLASSES;

/**
 * The panel: the shared panel surface (helm's, outlined in `--border`, `--neat-surface` set to its
 * fill) with its own size and padding.
 *
 * Its padding and the gap between its children are one number, `--neat-popover-inset` (helm's
 * `p-4` and `gap-4`, which it replaces): the menu rows below reach back across it to the panel's
 * edges, so the number is stated here and read there, never repeated.
 */
const PANEL_CLASSES = hlm(
  PANEL_SURFACE_CLASSES,
  '[--neat-popover-inset:var(--neat-space-4)] p-(--neat-popover-inset) gap-(--neat-popover-inset)',
);

/**
 * A menu row, the look of every `button[neatPopoverItem]`. In the panel's flex column a button
 * stretches across the panel's content box; the negative inline margin by the inset widens it to
 * the panel's edges, so the hover fill is a band edge to edge, and the same inset as padding keeps
 * the text where the panel's padding put it. The negative block margin takes back half of the
 * panel's gap above and below, so two rows touch; beside other content the gap that is left is
 * half the inset. The fill on hover and keyboard focus is `--accent`, the theme's hover fill, held
 * to text contrast under the label; keyboard focus adds the full-strength `--ring` inside the
 * row, which the row's neighbors cannot paint over (an outer ring would be clipped by them), and
 * a transparent outline that forced-colors mode paints in place of the ring. A disabled row
 * keeps its place and its text in `--muted-foreground`, takes no hover fill and no focus (a
 * disabled button is no tab stop). It stands on its own: not combined with `neatButton`, whose
 * classes would compete with these.
 */
const ITEM_CLASSES =
  '-mx-(--neat-popover-inset) -my-[calc(var(--neat-popover-inset)/2)] block cursor-pointer px-(--neat-popover-inset) py-2 text-left text-sm text-foreground outline-hidden enabled:hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground';

/**
 * The line between two groups of rows. It spans the panel like a row and sits 4px from the rows
 * around it: the same quarter of the inset below the gap a row leaves, `-my` taking back the rest.
 */
const DIVIDER_CLASSES =
  '-mx-(--neat-popover-inset) -my-[calc(var(--neat-popover-inset)/4)] border-t border-border';

/** The gap between the trigger and the panel, so the panel's outline does not touch the trigger. */
const SIDE_OFFSET = 4;

/** Numbers each `neat-popover`, for the panel id the trigger's `aria-controls` names. */
let nextPopoverId = 0;

/** The panel's content: `<ng-template neatPopoverContent>…</ng-template>` inside `neat-popover`. */
@Directive({ selector: 'ng-template[neatPopoverContent]' })
export class NeatPopoverContent {
  /**
   * @internal The template `neat-popover` renders; apps never read it.
   */
  readonly template = inject(TemplateRef);
}

/**
 * The button that opens and closes a `neat-popover`: `<button neatPopoverTrigger>` inside it. It
 * can be a `neatButton` with a tooltip as well. It announces the dialog it opens
 * (`aria-haspopup`, `aria-expanded`) and names the panel in `aria-controls` while it is open.
 *
 * The kit's own rather than brain's trigger: brain's points `aria-controls` at the panel while it
 * is closed too, when no element has that id.
 */
@Directive({
  selector: 'button[neatPopoverTrigger]',
  host: {
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'popover.open()',
    '[attr.aria-controls]': 'popover.open() ? popover.panelId : null',
    '(click)': 'popover.toggle()',
  },
})
export class NeatPopoverTrigger {
  protected readonly popover = inject(NeatPopover);
  /**
   * @internal The button, which `neat-popover` anchors its panel to and returns the focus to;
   * apps never read it.
   */
  readonly element: HTMLButtonElement = inject(ElementRef).nativeElement;
}

/**
 * A menu row of a `neat-popover`'s panel (the ⋯ menu): `<button neatPopoverItem>` inside the
 * content. It fills the panel's width, text at the start, and touches the next row. Rows are
 * plain buttons in the order they are written, which is their Tab order.
 */
@Directive({ selector: 'button[neatPopoverItem]', host: { '[class]': 'itemClasses' } })
export class NeatPopoverItem {
  protected readonly itemClasses = ITEM_CLASSES;
}

/** A line between two groups of menu rows: `<hr neatPopoverDivider />` among the items. */
@Directive({
  selector: 'hr[neatPopoverDivider]',
  host: { role: 'separator', '[class]': 'dividerClasses' },
})
export class NeatPopoverDivider {
  protected readonly dividerClasses = DIVIDER_CLASSES;
}

/**
 * A panel of controls that opens below a button and stays open while they are used:
 *
 * ```html
 * <neat-popover label="View options" align="end" [(open)]="viewOptionsOpen">
 *   <button neatButton neatPopoverTrigger iconOnly aria-label="View options">…</button>
 *   <ng-template neatPopoverContent>…</ng-template>
 * </neat-popover>
 * ```
 *
 * The panel is a non-modal dialog named by `label`, on the popover surface. `align` lines it up
 * with the trigger's start, center or end; it flips above the trigger when there is no room below.
 * The content template is created on opening and destroyed on closing, so keep its state (a typed
 * value, a checked switch) in the page. On opening, focus moves to the panel's first enabled
 * control. Escape, a click outside, the trigger, or `open` set to false close it; focus then goes
 * back to the trigger, unless the closing click put it somewhere else. Setting `open` to true
 * opens it as the trigger does, which is how a keyboard shortcut opens it.
 *
 * The panel is rendered at the end of the document, so the browser's Tab order does not pass
 * through it from the trigger. The kit carries it across by hand: Tab from the panel's last
 * control closes it and focuses the first tabbable element after the trigger, and Shift+Tab from
 * its first control closes it and focuses the trigger. Focus arriving anywhere else outside the
 * trigger and the panel (a click on another control, Tab from the trigger, a second popover
 * opening) closes it too, and focus stays where it went. Focus arriving in an overlay opened from
 * the panel, such as a `NeatConfirm`, does not close it.
 *
 * In the page toolbar, an open popover keeps the kiosk bar shown (`KioskService.holdToolbar`):
 * the panel lies outside the bar, so a pointer resting on it would otherwise fade the bar out.
 *
 * Brain's popover is the host directive: it places the panel, closes it on Escape and outside
 * clicks and moves focus in and out. The kit renders the dialog element itself, so that it can
 * name it, and gives the overlay pane around it no role.
 *
 * @input align Which edge of the trigger the panel lines up with: `start`, `center` (the default)
 * or `end`. Use `end` for a trigger at the right edge of a toolbar, so the panel opens inward.
 */
@Component({
  selector: 'neat-popover',
  imports: [BrnPopoverContent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideBrnPopoverConfig({ sideOffset: SIDE_OFFSET }),
    // Brain moves focus into the panel itself, to the first element CDK calls tabbable, and CDK
    // calls a disabled button tabbable: a menu whose first row is disabled would keep the focus on
    // the trigger. The kit moves it (see `focusFirstControl`), past what is disabled.
    provideBrnPopoverDefaultOptions({ role: null, autoFocus: false }),
  ],
  hostDirectives: [{ directive: BrnPopover, inputs: ['align'] }],
  // The trigger takes part in the surrounding layout (a toolbar's row) as if it stood there alone.
  host: { class: 'contents' },
  template: `
    <ng-content />
    <ng-template brnPopoverContent>
      <div
        role="dialog"
        [id]="panelId"
        [attr.aria-label]="label()"
        [attr.data-state]="brain.stateComputed()"
        [class]="panelClasses"
        (keydown)="carryTabOrder($event)"
      >
        <ng-container [ngTemplateOutlet]="content().template" />
      </div>
    </ng-template>
  `,
})
export class NeatPopover {
  /** Whether the panel is open; it follows the trigger, Escape and outside clicks. */
  readonly open = model(false);
  /** The panel's accessible name. */
  readonly label = input.required<string>();

  /**
   * @internal The panel's id, which the trigger's `aria-controls` names; apps never read it.
   */
  readonly panelId = `neat-popover-${++nextPopoverId}`;
  protected readonly panelClasses: string = PANEL_CLASSES;
  protected readonly brain = inject(BrnPopover);
  protected readonly content = contentChild.required(NeatPopoverContent);
  private readonly trigger = contentChild.required(NeatPopoverTrigger);
  private readonly focus = new OverlayFocus(
    () => this.trigger().element,
    () => this.open.set(false),
  );
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  constructor() {
    // Brain closes the panel on Escape and outside clicks; the model follows. Brain's output lives
    // on this same host, so the subscription ends with it.
    this.brain.stateChanged.subscribe((state) => this.open.set(state === 'open'));

    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.brain.close()));
    });

    effect((onCleanup) => {
      if (this.open()) {
        onCleanup(this.focus.watchOutsideFocus());
      }
    });

    const kiosk = inject(KioskService);
    if (inject(IN_PAGE_TOOLBAR)) {
      effect((onCleanup) => {
        if (this.open() && kiosk.active()) {
          onCleanup(kiosk.holdToolbar());
        }
      });
    }
  }

  /** Opens or closes the panel, as the trigger does. */
  toggle(): void {
    this.open.update((open) => !open);
  }

  /** Carries the Tab order across the panel, which the browser cannot (see `OverlayFocus`). */
  protected carryTabOrder(event: KeyboardEvent): void {
    this.focus.carryTabOrder(event, event.currentTarget as HTMLElement);
  }

  private show(): void {
    const trigger = this.trigger().element;
    // Brain gives focus back on closing to whatever had it on opening. That must be the trigger
    // however the panel opened: from a shortcut, or by a click in Safari, which does not focus
    // the button it clicks.
    trigger.focus({ preventScroll: true });
    this.brain.setOrigin(trigger);
    this.brain.open();
    afterNextRender(
      () => {
        if (this.open()) {
          this.focus.focusFirstControl(this.document.getElementById(this.panelId));
        }
      },
      { injector: this.injector },
    );
  }
}
