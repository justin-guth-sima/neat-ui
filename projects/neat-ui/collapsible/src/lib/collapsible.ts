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
import { NeatIcon } from '@sima/neat-ui';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. Colours are the theme's tokens only; collapsible.spec holds the label and the summary to
 * 4.5:1 on every surface. Helm's collapsible has one class, the closed content's `hidden`, which
 * CONTENT_CLASSES states through the preset's `data-closed` variant, so none is vendored.
 */

/**
 * The trigger: a full-width text button, its chevron, label and summary on one line. It draws the
 * kit's focus outline at full `--ring` (held to 3:1 by the theme). Hovering it brings the chevron
 * from the muted colour to the text's, the only hover cue a button with no fill has.
 */
const TRIGGER_CLASSES =
  'group flex w-full min-w-0 cursor-pointer items-center gap-(--neat-space-2) rounded-(--radius) py-1 text-start text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring';

/**
 * The chevron: turned a quarter while open, by a transform the kit's transition duration times and
 * that a reduced-motion setting turns into a jump, as the kit's other motion is.
 */
const CHEVRON_CLASSES =
  'shrink-0 text-muted-foreground transition-transform duration-(--neat-transition-duration) group-hover:text-foreground motion-reduce:transition-none';

/**
 * The content. Brain makes it `inert` while closed (no focus, no clicks) but leaves it shown, so
 * the kit hides it: `data-state` is brain's, and the one variant is the content's only display
 * statement (a `div` is a block already), so no class has to lose to it.
 */
const CONTENT_CLASSES = 'pt-(--neat-space-2) data-closed:hidden';

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
 * focus moves to the trigger: inert content would otherwise drop it to the page.
 *
 * Elements marked `neatCollapsibleEnd` sit at the end of the trigger's row, outside the trigger
 * and its heading: the section's own controls (a copy button over a code sample, a file choice),
 * which act without opening or closing it. The trigger takes the rest of the row. They show
 * whether the section is open or closed; an app shows them only while open with an `@if`.
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
    <!-- The trigger's row: the trigger takes what the app's controls beside it leave. -->
    <div data-slot="collapsible-row" class="flex items-center gap-(--neat-space-2)">
      <!-- A heading only at a level the app sets; otherwise a plain wrapper. -->
      <div
        data-slot="collapsible-heading"
        class="min-w-0 flex-1"
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
          <span class="shrink-0 font-medium">{{ label() }}</span>
          @if (!brain.expanded() && summary()) {
            <span data-slot="collapsible-summary" class="min-w-0 truncate text-muted-foreground">{{
              summary()
            }}</span>
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
  protected readonly triggerClasses = TRIGGER_CLASSES;
  protected readonly chevronClasses = CHEVRON_CLASSES;
  protected readonly contentClasses = CONTENT_CLASSES;

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
        if (this.content()?.nativeElement.contains(document.activeElement)) {
          this.trigger()?.nativeElement.focus();
        }
      });
    });
  }
}
