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
import { InteractivityChecker } from '@angular/cdk/a11y';
import { OverlayContainer } from '@angular/cdk/overlay';
import {
  BrnPopover,
  BrnPopoverContent,
  provideBrnPopoverConfig,
  provideBrnPopoverDefaultOptions,
} from '@spartan-ng/brain/popover';
import { KioskService, ɵhlm as hlm, ɵIN_PAGE_TOOLBAR as IN_PAGE_TOOLBAR } from '@sima/neat-ui';

/** Which edge of the trigger the panel lines up with: its `start`, its `center` or its `end`. */
export type NeatPopoverAlign = 'start' | 'center' | 'end';

/**
 * Helm's popover classes (`lib/ui/popover`), copied because helm keeps them inline. popover.spec
 * checks that the string still appears in the vendored helm, so a helm update that changes it
 * fails until this table is reviewed.
 */
export const POPOVER_HELM_CLASSES = {
  /** `hlm-popover-content.ts`: the panel. */
  content:
    'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 gap-4 rounded-md p-4 text-sm shadow-md ring-1 duration-100 relative flex w-72 flex-col outline-none',
} as const;

/**
 * The panel: helm's, outlined in `--border`, the theme's colour for card outlines and dividers,
 * where helm draws the text colour at 10%. It sets `--neat-surface` to its fill, `--popover`: what
 * the content sits on, so that a part that covers what scrolls under it (a select list's sticky
 * header) fills with the panel's colour, not the page's.
 *
 * Its padding and the gap between its children are one number, `--neat-popover-inset` (helm's
 * `p-4` and `gap-4`, which it replaces): the menu rows below reach back across it to the panel's
 * edges, so the number is stated here and read there, never repeated.
 */
const PANEL_CLASSES = hlm(
  POPOVER_HELM_CLASSES.content,
  'ring-border [--neat-surface:var(--popover)] [--neat-popover-inset:var(--neat-space-4)] p-(--neat-popover-inset) gap-(--neat-popover-inset)',
);

/**
 * A menu row, the look of every `button[neatPopoverItem]`. In the panel's flex column a button
 * stretches across the panel's content box; the negative inline margin by the inset widens it to
 * the panel's edges, so the hover fill is a band edge to edge, and the same inset as padding keeps
 * the text where the panel's padding put it. The negative block margin takes back half of the
 * panel's gap above and below, so two rows touch; beside other content the gap that is left is
 * half the inset. The fill on hover and keyboard focus is `--accent`, the theme's hover fill, held
 * to text contrast under the label; keyboard focus adds the full-strength `--ring` inside the
 * row, which the row's neighbours cannot paint over (an outer ring would be clipped by them), and
 * a transparent outline that forced-colours mode paints in place of the ring. A disabled row
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
 * with the trigger's start, centre or end; it flips above the trigger when there is no room below.
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

  readonly panelId = `neat-popover-${++nextPopoverId}`;
  protected readonly panelClasses: string = PANEL_CLASSES;
  protected readonly brain = inject(BrnPopover);
  protected readonly content = contentChild.required(NeatPopoverContent);
  private readonly trigger = contentChild.required(NeatPopoverTrigger);
  private readonly overlayContainer = inject(OverlayContainer);
  private readonly interactivity = inject(InteractivityChecker);
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

    // A safety net for every way focus can arrive outside the popover. It listens for where focus
    // lands, not where it left: Tab from the panel's last control can leave the document, and
    // focus then comes back on the page's first element with no `focusout` naming it. A `focusout`
    // with no target (another window took focus) is not a move, so it is deliberately not heard.
    effect((onCleanup) => {
      if (!this.open()) {
        return;
      }
      const closeOnOutsideFocus = (event: FocusEvent) => {
        if (event.target instanceof Node && !this.holdsFocus(event.target)) {
          this.open.set(false);
        }
      };
      this.document.addEventListener('focusin', closeOnOutsideFocus);
      onCleanup(() => this.document.removeEventListener('focusin', closeOnOutsideFocus));
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

  /**
   * Carries the Tab order across the panel, which the browser cannot: the panel is rendered in
   * CDK's overlay container at the end of the document, not next to the trigger. Tab from the
   * panel's last tabbable control would leave the document, and Shift+Tab from its first would
   * land on the last control of the page. So both close the panel and move focus where it would
   * go if the panel sat after the trigger: the first tabbable after the trigger, or the trigger
   * itself. With nothing tabbable after the trigger, the browser's own Tab is left to run.
   */
  protected carryTabOrder(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const tabbables = this.tabbablesIn(event.currentTarget as HTMLElement);
    if (event.shiftKey && event.target === tabbables[0]) {
      event.preventDefault();
      this.open.set(false);
      this.trigger().element.focus();
    } else if (!event.shiftKey && event.target === tabbables.at(-1)) {
      const next = this.tabbableAfterTrigger();
      if (next) {
        event.preventDefault();
        next.focus();
      }
      this.open.set(false);
    }
  }

  /**
   * Whether focus on `node` leaves the popover as it is: the trigger, and CDK's overlay container.
   * The container holds the panel and every other overlay, apart from the panel's own DOM, so an
   * element's ancestry cannot tell an overlay opened from the panel (a `NeatConfirm`) from any
   * other. None takes focus on its own while the panel is open, and another popover's trigger lies
   * outside the container, so the container is the narrowest test that keeps the dialogs a panel's
   * controls open.
   */
  private holdsFocus(node: Node): boolean {
    return (
      this.trigger().element.contains(node) ||
      this.overlayContainer.getContainerElement().contains(node)
    );
  }

  /**
   * The tabbable elements under `root` in document order, as CDK's focus trap judges them
   * (`InteractivityChecker`): it knows tabindex, disabled and hidden elements, which a selector
   * list would get wrong. The overlay container's subtree is left out when `root` holds it.
   */
  private tabbablesIn(root: Node): HTMLElement[] {
    const container = this.overlayContainer.getContainerElement();
    const walker = this.tabbableWalker(root, container);
    const found: HTMLElement[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      found.push(node as HTMLElement);
    }
    return found;
  }

  /**
   * Moves focus to the panel's first enabled control, where the panel opens. CDK's `isTabbable`
   * only reads `tabIndex`, which a disabled button has too, so a disabled control is skipped here
   * and in every walk of this class. With none, the focus stays on the trigger.
   */
  private focusFirstControl(): void {
    const panel = this.document.getElementById(this.panelId);
    if (panel) {
      this.tabbablesIn(panel)[0]?.focus();
    }
  }

  /** The first tabbable element after the trigger in the page, outside the overlay container. */
  private tabbableAfterTrigger(): HTMLElement | null {
    const walker = this.tabbableWalker(
      this.document.body,
      this.overlayContainer.getContainerElement(),
    );
    walker.currentNode = this.trigger().element;
    return walker.nextNode() as HTMLElement | null;
  }

  /** A walker over `root`'s tabbable elements that does not enter `excluded`. */
  private tabbableWalker(root: Node, excluded: Element): TreeWalker {
    return this.document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, (node) => {
      if (node === excluded) {
        return NodeFilter.FILTER_REJECT;
      }
      const element = node as HTMLElement;
      return this.interactivity.isTabbable(element) && !this.interactivity.isDisabled(element)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    });
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
          this.focusFirstControl();
        }
      },
      { injector: this.injector },
    );
  }
}
