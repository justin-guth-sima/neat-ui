import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  model,
  TemplateRef,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  BrnPopover,
  BrnPopoverContent,
  provideBrnPopoverConfig,
  provideBrnPopoverDefaultOptions,
} from '@spartan-ng/brain/popover';
import { KioskService } from '../kiosk/kiosk.service';
import { IN_PAGE_TOOLBAR } from '../shell/page-toolbar';
import { hlm } from '../ui/utils/src';

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
 * where helm draws the text colour at 10%.
 */
const PANEL_CLASSES = hlm(POPOVER_HELM_CLASSES.content, 'ring-border');

/** The gap between the trigger and the panel, so the panel's outline does not touch the trigger. */
const SIDE_OFFSET = 4;

/** Numbers each `neat-popover`, for the panel id the trigger's `aria-controls` names. */
let nextPopoverId = 0;

/** The panel's content: `<ng-template neatPopoverContent>…</ng-template>` inside `neat-popover`. */
@Directive({ selector: 'ng-template[neatPopoverContent]' })
export class NeatPopoverContent {
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
 * value, a checked switch) in the page. On opening, focus moves to the panel's first focusable
 * element. Escape, a click outside, the trigger, or `open` set to false close it; focus then goes
 * back to the trigger, unless the closing click put it somewhere else. Setting `open` to true
 * opens it as the trigger does, which is how a keyboard shortcut opens it.
 *
 * In the page toolbar, an open popover keeps the kiosk bar shown (`KioskService.holdToolbar`):
 * the panel lies outside the bar, so a pointer resting on it would otherwise fade the bar out.
 *
 * Brain's popover is the host directive: it places the panel, closes it on Escape and outside
 * clicks and moves focus in and out. The kit renders the dialog element itself, so that it can
 * name it, and gives the overlay pane around it no role.
 */
@Component({
  selector: 'neat-popover',
  imports: [BrnPopoverContent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideBrnPopoverConfig({ sideOffset: SIDE_OFFSET }),
    provideBrnPopoverDefaultOptions({ role: null }),
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

  constructor() {
    // Brain closes the panel on Escape and outside clicks; the model follows. Brain's output lives
    // on this same host, so the subscription ends with it.
    this.brain.stateChanged.subscribe((state) => this.open.set(state === 'open'));

    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.show() : this.brain.close()));
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

  private show(): void {
    const trigger = this.trigger().element;
    // Brain gives focus back on closing to whatever had it on opening. That must be the trigger
    // however the panel opened: from a shortcut, or by a click in Safari, which does not focus
    // the button it clicks.
    trigger.focus({ preventScroll: true });
    this.brain.setOrigin(trigger);
    this.brain.open();
  }
}
