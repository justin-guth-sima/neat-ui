import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import {
  BrnCollapsible,
  BrnCollapsibleContent,
  BrnCollapsibleTrigger,
} from '@spartan-ng/brain/collapsible';
import { NeatIcon, ɵCOLLAPSIBLE_CLASSES as CLASSES } from '@sima/neat-ui';

/*
 * The trigger, chevron, label, summary and content are the primary's collapsible look
 * (`ɵCOLLAPSIBLE_CLASSES`), which the page's side list shares on a narrow screen. Class strings
 * stay literals: Tailwind finds the classes the kit stylesheet needs by reading them.
 */

/**
 * The trigger's row, with the app's `neatCollapsibleEnd` controls after the trigger. It wraps: the
 * controls drop to a line of their own before they take the room of the label and its summary.
 */
const ROW_CLASSES = 'flex flex-wrap items-center gap-(--neat-space-2)';

/**
 * The heading around the trigger: its own width as its basis (the chevron, the label and the
 * summary), never a basis of 0 that the controls beside it could shrink to nothing, and growing
 * into the rest of its line. Alone on its line it may still shrink, which truncates the summary.
 */
const HEADING_CLASSES = 'min-w-0 grow';

/**
 * A section that a full-width button opens and closes, such as a panel's "Details":
 *
 * ```html
 * <neat-collapsible label="Details" [summary]="mode()" [(open)]="detailsOpen">…</neat-collapsible>
 * ```
 *
 * The trigger shows the `next` chevron (turned a quarter while open), `label` and, only while
 * closed, `summary` in muted text that truncates, for what the section holds at a glance. It is a
 * native button that names the content in `aria-controls` and says whether it is open in
 * `aria-expanded`; Enter and Space work as on any button. `open` is two-way bound. With
 * `headingLevel`, the button sits in a heading of that level (the WAI-ARIA disclosure and accordion
 * patterns), so the section's title is in the page's outline.
 *
 * The content stays instantiated while closed (hidden and `inert`), so its state survives a close;
 * gate expensive content (a live preview) on `open` with an `@if` of your own. When the section
 * closes with the focus inside it (a Save that closes it, the app setting `open` to false), the
 * focus moves to the trigger: inert content would otherwise drop it to the page. So it does when
 * the focus was on an end control that the close removed (one shown only while open); an end
 * control that stays keeps the focus.
 *
 * Elements marked `neatCollapsibleEnd` sit at the end of the trigger's row, outside the trigger
 * and its heading: the section's own controls (a copy button over a code sample, a file choice),
 * which act without opening or closing it. The trigger takes the rest of the row, and the
 * controls drop to a second line where they would leave the label and summary no room: the
 * trigger's width is both in full, so a long summary wraps the controls before it truncates. They
 * show whether the section is open or closed; an app shows them only while open with an `@if`.
 *
 * Brain's collapsible is the host directive and its trigger and content directives sit in the
 * template; `open` is brain's `expanded` under the kit's name.
 *
 * @input open Whether the section is open; closed by default. Bind it two-way, `[(open)]`, to
 * keep the state in the page or to open or close the section from code.
 */
@Component({
  selector: 'neat-collapsible',
  imports: [BrnCollapsibleTrigger, BrnCollapsibleContent, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BrnCollapsible,
      inputs: ['expanded: open'],
      outputs: ['expandedChange: openChange'],
    },
  ],
  host: { class: 'block' },
  template: `
    <div
      data-slot="collapsible-row"
      [class]="rowClasses"
      (focusin)="noteFocus($event)"
      (focusout)="forgetFocus($event)"
    >
      <!-- A heading only at a level the app sets; otherwise a plain wrapper. -->
      <div
        data-slot="collapsible-heading"
        [class]="headingClasses"
        [attr.role]="headingLevel() ? 'heading' : null"
        [attr.aria-level]="headingLevel()"
      >
        <button
          #trigger
          brnCollapsibleTrigger
          data-slot="collapsible-trigger"
          [class]="triggerClasses"
        >
          <neat-icon
            name="next"
            [size]="16"
            [class]="chevronClasses"
            [class.rotate-90]="brain.expanded()"
          />
          <span [class]="labelClasses">{{ label() }}</span>
          @if (!brain.expanded() && summary()) {
            <span data-slot="collapsible-summary" [class]="summaryClasses">{{ summary() }}</span>
          }
        </button>
      </div>
      <!-- Outside the heading and the button: controls of their own, never part of the name. -->
      <ng-content select="[neatCollapsibleEnd]" />
    </div>
    <div #content brnCollapsibleContent data-slot="collapsible-content" [class]="contentClasses">
      <ng-content />
    </div>
  `,
})
export class NeatCollapsible {
  /** The trigger's text, which names the section. */
  readonly label = input.required<string>();
  /** What the section holds, shown beside the label while it is closed; none if empty. */
  readonly summary = input('');
  /**
   * The level of the heading the trigger sits in, for a section that is part of an outline (System
   * Info's); none by default, for a disclosure such as a panel's "Details".
   */
  readonly headingLevel = input<2 | 3 | 4 | 5 | 6 | null>(null);

  protected readonly brain = inject(BrnCollapsible);
  protected readonly triggerClasses = CLASSES.trigger;
  protected readonly chevronClasses = CLASSES.chevron;
  protected readonly labelClasses = CLASSES.label;
  protected readonly summaryClasses = CLASSES.summary;
  protected readonly contentClasses = CLASSES.content;
  protected readonly rowClasses = ROW_CLASSES;
  protected readonly headingClasses = HEADING_CLASSES;

  /** The end control that has the focus, kept to tell whether a close removed it. */
  private endFocus: HTMLElement | null = null;

  // Optional: the first run of the effect below comes before the view exists.
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly content = viewChild<ElementRef<HTMLElement>>('content');

  constructor() {
    const document = inject(DOCUMENT);
    // A component's effect runs before its view is refreshed, so the content is not inert yet and
    // still holds the focus when this looks for it.
    effect(() => {
      if (this.brain.expanded()) return;
      untracked(() => {
        // The app's own view is refreshed first, so an end control the close removed is gone.
        const endRemoved = this.endFocus !== null && !this.endFocus.isConnected;
        // A removed control gives the focus up to the page, so only a focus that is lost is
        // rescued: one the user has since moved elsewhere (a click on the blank page) stays.
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (
          (endRemoved && lost) ||
          this.content()?.nativeElement.contains(document.activeElement)
        ) {
          this.trigger()?.nativeElement.focus();
        }
        this.endFocus = null;
      });
    });
  }

  protected noteFocus(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    this.endFocus = target === this.trigger()?.nativeElement ? null : target;
  }

  /**
   * A move of the focus to another element. A focusout with no `relatedTarget` is the focus
   * leaving the page or, in Chrome, an element being removed while it still has the focus (still
   * connected, so `isConnected` cannot tell): the note stays, for the close to see.
   */
  protected forgetFocus(event: FocusEvent): void {
    if (event.relatedTarget) this.endFocus = null;
  }
}
