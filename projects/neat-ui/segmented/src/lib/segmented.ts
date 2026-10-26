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
 * count and the chosen index alone, as two custom properties on the group, with no measuring. The
 * padding is the thumb's inset (`p-0.5`, which the thumb's `calc` takes off twice, 4px); the thumb's
 * radius is the track's less that inset. `isolate` keeps the thumb's and the segments' z-indexes
 * inside the control. Disabled dims the whole group, so the segments (disabled buttons) add none.
 */
const GROUP_CLASSES =
  'relative isolate inline-grid grid-flow-col auto-cols-fr rounded-lg bg-neat-segmented-track p-0.5 aria-disabled:opacity-50';

/**
 * The thumb: the chosen option's cell of the track, raised. It is `1 / count` of the width inside
 * the padding and moves by whole multiples of its own width (a percentage in `translate` is of the
 * element itself). The 280 ms curve is the switch's; reduced motion jumps instead.
 */
const THUMB_CLASSES =
  'pointer-events-none absolute inset-y-0.5 left-0.5 z-0 w-[calc((100%-4px)/var(--neat-segmented-count))] translate-x-[calc(var(--neat-segmented-index)*100%)] rounded-md bg-neat-segmented-thumb shadow-sm transition-transform duration-280 ease-[cubic-bezier(.3,.7,.2,1)] motion-reduce:transition-none';

/**
 * A segment, transparent above the thumb; the chosen one is the semibold primary label (primary on
 * the thumb is a pair the segmented spec holds to 4.5:1). Between two unchosen neighbours a 1px
 * divider is drawn on the segment's start edge (`before`), and hidden by `opacity` so that it fades
 * with the thumb's slide: not on the first segment (`first-of-type`: the thumb is the group's first
 * child), nor on the chosen one, nor on the one after it.
 * The focus ring is the full `--ring` (3:1) rather than a faint mix.
 */
const ITEM_CLASSES =
  'relative z-10 inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-transparent px-3.5 text-sm font-medium whitespace-nowrap text-foreground outline-none transition-colors duration-200 motion-reduce:transition-none disabled:pointer-events-none focus-visible:z-20 focus-visible:ring-[3px] focus-visible:ring-ring data-[state=on]:font-semibold data-[state=on]:text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-px before:bg-muted-foreground/40 before:transition-opacity before:duration-200 motion-reduce:before:transition-none first-of-type:before:hidden data-[state=on]:before:opacity-0 [[data-state=on]+&]:before:opacity-0';

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
 * Not built on brain's toggle group: brain makes its items pressed toggle buttons (`aria-pressed`,
 * rewritten on every change) with no arrow keys, while a choice of one is a radio group. The
 * roles, the roving tab stop, the keys and `data-state` are the kit's.
 */
@Component({
  selector: 'neat-segmented',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
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
          {{ option.label }}
        </button>
      }
    </div>
  `,
})
export class NeatSegmented<T> {
  readonly value = model.required<T>();
  readonly options = input.required<readonly NeatSegmentedOption<T>[]>();
  /** The group's accessible name; each option is named by its own label. */
  readonly label = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly groupClasses = GROUP_CLASSES;
  protected readonly thumbClasses = THUMB_CLASSES;
  protected readonly itemClasses = ITEM_CLASSES;
  /** The index of the checked option, or -1 when the value is none of the options. */
  protected readonly chosen = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );
  /** The option keyboard focus enters on, and where the thumb sits: the checked one, else the first. */
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
