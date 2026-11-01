import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { NeatIcon, type NeatIconName } from '@sima/neat-ui';

/** One choice of a `neat-segmented`: its value, its label and an optional icon before the label. */
export interface NeatSegmentedOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: NeatIconName;
}

/**
 * The track: a grid of equal columns, so that the thumb's width and position follow from the option
 * count and the chosen index alone, as two custom properties on the group, with no measuring.
 * The columns are `auto-cols-fr`, `minmax(0, 1fr)`: with room, the group is its widest label times
 * the count; in a container narrower than that the columns shrink together, still equal, and each
 * label clips with an ellipsis (see the label in the template). The padding is the thumb's inset
 * (`p-0.5`, which the thumb's `calc` takes off twice, 4px); the thumb's radius is the track's less
 * that inset. The segments are 28px (`h-7` below), so the control is 32px: the height of the small
 * buttons, icon buttons and the board pill it stands beside in a toolbar. `isolate` keeps the thumb's and the segments' z-indexes inside the control. Disabled
 * dims the whole group, so the segments (disabled buttons) add none.
 */
const GROUP_CLASSES =
  'relative isolate inline-grid grid-flow-col auto-cols-fr rounded-lg bg-neat-segmented-track p-0.5 aria-disabled:opacity-50';

/**
 * The thumb: the chosen option's cell of the track, raised. It is `1 / count` of the width inside
 * the padding and moves by whole multiples of its own width (a percentage in `translate` is of the
 * element itself). The 280 ms curve is the switch's; reduced motion jumps instead. The 1px ring is
 * the thumb's edge: in dark the fill is only about 1.1:1 from the track (the primary label caps
 * how light it can be) and a shadow does not show, so a lighter hairline outlines it.
 */
const THUMB_CLASSES =
  'pointer-events-none absolute inset-y-0.5 left-0.5 z-0 w-[calc((100%-4px)/var(--neat-segmented-count))] translate-x-[calc(var(--neat-segmented-index)*100%)] rounded-md bg-neat-segmented-thumb shadow-sm ring-1 ring-neat-segmented-thumb-edge transition-transform duration-280 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none';

/**
 * A segment, transparent above the thumb; the chosen one is the semibold primary label (primary on
 * the thumb is a pair the segmented spec holds to 4.5:1). Between two unchosen neighbours a 1px
 * divider is drawn on the segment's start edge (`before`), and hidden by `opacity` so that it fades
 * with the thumb's slide: not on the first segment (`first-of-type`: the thumb is the group's first
 * child), nor on the chosen one, nor on the one after it. The divider is `--muted-foreground` at
 * 40%, not `--border`, which in dark is the very colour of the track and would vanish. The focus
 * ring is the full `--ring` (3:1) rather than a faint mix. The label sits in one grid cell with an
 * invisible, `aria-hidden` semibold copy of itself (the template), so that every column is as wide
 * as semibold needs and the control keeps its width, and its neighbours their places, as the
 * choice moves; the copy is not part of the accessible name. The cell may shrink below the label
 * (`min-w-0` in the segment's flex row, one column with a 0 minimum) and both copies `truncate`
 * in it: a narrow container clips the labels with an ellipsis instead of overlapping them, and
 * the invisible copy cannot overflow. The clipping is visual only: the name stays the whole label,
 * and the label's `title` shows it on hover, as the progress readout's clipped heading does.
 */
const ITEM_CLASSES =
  'relative z-10 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-transparent px-3.5 text-sm font-medium whitespace-nowrap text-foreground outline-none transition-colors duration-200 motion-reduce:transition-none disabled:pointer-events-none focus-visible:z-20 focus-visible:ring-[3px] focus-visible:ring-ring data-[state=on]:font-semibold data-[state=on]:text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-muted-foreground/40 before:transition-opacity before:duration-200 motion-reduce:before:transition-none first-of-type:before:hidden data-[state=on]:before:opacity-0 [[data-state=on]+&]:before:opacity-0';

/** Keys that move the selection, and where to: the next index from the current one of `count`. */
const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowDown: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowUp: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * A row of mutually exclusive choices, such as a tile shape: `<neat-segmented label="Tile shape"
 * [options]="shapes" [(value)]="shape" />`. It is a radio group named by `label`: one tab stop
 * (the checked option, else the first), arrow keys move the choice and wrap, Home and End jump to
 * the ends, and a click on the checked option keeps it checked.
 *
 * Drawn as an iOS-style switch: a track with a raised thumb that slides under the chosen label.
 * Its width does not move with the choice: every column is as wide as the widest label needs, in
 * semibold.
 *
 * It never gives up width to its neighbours: in a flex row too narrow for everything in it, the
 * control keeps its labels whole and the text beside it gives way (that text needs `min-width: 0`
 * to shrink). It is never wider than its container, though: in one narrower than its labels (a
 * side panel dragged narrow) the options shrink together, still equal, and each label ends in an
 * ellipsis, its full text still the option's name and shown as a tooltip on hover.
 *
 * Not built on brain's toggle group: brain makes its items pressed toggle buttons (`aria-pressed`,
 * rewritten on every change) with no arrow keys, while a choice of one is a radio group. The
 * roles, the roving tab stop, the keys and `data-state` are the kit's.
 */
@Component({
  selector: 'neat-segmented',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // `max-w-full`: the control is at most as wide as its container, inside which its labels clip.
  // `shrink-0`: in a flex row it keeps the width its labels need (up to that cap), so a row that
  // runs out of room moves or wraps it, or squeezes its other items, never the control.
  host: { class: 'inline-flex max-w-full shrink-0' },
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="label()"
      [attr.aria-disabled]="disabled() || null"
      data-orientation="horizontal"
      [style.--neat-segmented-count]="options().length"
      [style.--neat-segmented-index]="tabStop()"
      [class]="groupClasses"
    >
      @if (chosen() >= 0) {
        <span aria-hidden="true" data-slot="segmented-thumb" [class]="thumbClasses"></span>
      }
      @for (option of options(); track option.value; let index = $index) {
        <button
          #segment
          type="button"
          role="radio"
          [attr.aria-checked]="option.value === value()"
          [attr.data-state]="option.value === value() ? 'on' : 'off'"
          [tabIndex]="index === tabStop() ? 0 : -1"
          [disabled]="disabled()"
          [class]="itemClasses"
          (click)="value.set(option.value)"
          (keydown)="move($event, index)"
        >
          @if (option.icon) {
            <neat-icon [name]="option.icon" [size]="16" />
          }
          <span data-slot="segmented-label" class="inline-grid min-w-0 grid-cols-1 text-center">
            <span class="col-start-1 row-start-1 truncate" [attr.title]="option.label">{{
              option.label
            }}</span>
            <span
              aria-hidden="true"
              data-slot="segmented-label-reserve"
              class="invisible col-start-1 row-start-1 truncate font-semibold"
              >{{ option.label }}</span
            >
          </span>
        </button>
      }
    </div>
  `,
})
export class NeatSegmented<T> {
  /**
   * The checked option's value, matched with `===`; bind it two-way, `[(value)]`. A value that is
   * none of the options leaves nothing checked.
   */
  readonly value = model.required<T>();
  /** The segments in the order shown, each a value with the label (and icon) it carries. */
  readonly options = input.required<readonly NeatSegmentedOption<T>[]>();
  /** The group's accessible name; each option is named by its own label. */
  readonly label = input.required<string>();
  /** Turns every segment off at once; there is no per-option disabling. */
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly groupClasses = GROUP_CLASSES;
  protected readonly thumbClasses = THUMB_CLASSES;
  protected readonly itemClasses = ITEM_CLASSES;
  /** The index of the checked option, or -1 when the value is none of the options. */
  protected readonly chosen = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );
  /**
   * The option keyboard focus enters on: the checked one, else the first. It is also the thumb's
   * index: the thumb is drawn only while an option is checked, and then the two are the same.
   */
  protected readonly tabStop = computed(() => Math.max(0, this.chosen()));

  private readonly segments = viewChildren<ElementRef<HTMLButtonElement>>('segment');

  /** Focuses the control's tab stop, the checked option (else the first): where Tab enters it. */
  focus(): void {
    this.segments()[this.tabStop()]?.nativeElement.focus();
  }

  /** Moves the choice from the segment at `current` (the one with focus) as the key says. */
  protected move(event: KeyboardEvent, current: number): void {
    const next = MOVES[event.key];
    if (!next || this.disabled()) return;
    event.preventDefault();
    const options = this.options();
    const index = next(current, options.length);
    this.value.set(options[index].value);
    this.segments()[index]?.nativeElement.focus();
  }
}
