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

/** The chevron: turned a quarter while open, by a transform the theme's motion setting times. */
const CHEVRON_CLASSES =
  'shrink-0 text-muted-foreground transition-transform duration-(--neat-transition-duration) group-hover:text-foreground';

/**
 * The content. Brain makes it `inert` while closed (no focus, no clicks) but leaves it shown, so
 * the kit hides it: `data-state` is brain's, and the one variant states the closed look.
 */
const CONTENT_CLASSES = 'block pt-(--neat-space-2) data-closed:hidden';

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
 * `aria-expanded`; Enter and Space work as on any button. `open` is two-way bound.
 *
 * The content stays instantiated while closed (hidden and `inert`), so its state survives a close;
 * gate expensive content (a live preview) on `open` with an `@if` of your own. When the section
 * closes with the focus inside it (a Save that closes it, the app setting `open` to false), the
 * focus moves to the trigger: inert content would otherwise drop it to the page.
 *
 * Brain's collapsible is the host directive and its trigger and content directives sit in the
 * template; `open` is brain's `expanded` under the kit's name.
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
    <button #trigger brnCollapsibleTrigger data-slot="collapsible-trigger" [class]="triggerClasses">
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
