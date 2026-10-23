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
import { NeatIcon } from '../icon/icon';
import type { NeatIconName } from '../icon/icon-registry';
import { toggleVariants } from '../ui/toggle/src';
import { hlm } from '../ui/utils/src';

/** One choice of a `neat-segmented`: its value, its label and an optional icon before the label. */
export interface NeatSegmentedOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: NeatIconName;
}

/**
 * Helm's toggle-group classes (`lib/ui/toggle-group`), copied because helm keeps them inline; the
 * segment's variant classes come from helm's exported `toggleVariants`. segmented.spec checks
 * that each copied string still appears in the vendored helm, so a helm update that changes one
 * fails until this table is reviewed.
 */
export const SEGMENTED_HELM_CLASSES = {
  /** `hlm-toggle-group.ts` */
  group:
    'rounded-md data-[spacing=0]:data-[variant=outline]:shadow-xs group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch',
  /** `hlm-toggle-group-item.ts` */
  item: 'data-[state=on]:bg-muted group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:shadow-none group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-s-md group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-md group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-e-md group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-md shrink-0 focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t',
} as const;

/**
 * A segment: helm's outline toggle with the kit's states. Each override exists because
 * segmented.spec failed without it.
 * - Checked: helm's `bg-muted` is 1.10:1 on white, too faint to show which segment is chosen
 *   (3:1). The kit fills the checked segment with the primary colour and its foreground, a pair
 *   the theme guarantees, and on hover with `--primary-hover`, which only gains text contrast.
 * - Hover: `bg-muted` is 1.10:1 on white; `--accent`, the theme's hover fill, stays visible.
 * - Focus ring: helm's `ring-ring/50` is about 1.85:1 on white; the kit draws full `--ring`.
 */
const ITEM_CLASSES = hlm(
  SEGMENTED_HELM_CLASSES.item,
  toggleVariants({ variant: 'outline', size: 'default' }),
  'hover:bg-accent focus-visible:ring-ring',
  'data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
  'data-[state=on]:hover:bg-primary-hover data-[state=on]:hover:text-primary-foreground',
);

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
 * Built on helm's toggle-group look but not on brain's toggle group: brain makes its items pressed
 * toggle buttons (`aria-pressed`, rewritten on every change) with no arrow keys, while a choice of
 * one is a radio group. The roles, the roving tab stop, the keys and `data-state` are the kit's.
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
      data-variant="outline"
      data-spacing="0"
      data-orientation="horizontal"
      [class]="groupClasses"
    >
      @for (option of options(); track option.value; let index = $index) {
        <button
          #segment
          type="button"
          role="radio"
          [attr.aria-checked]="option.value === value()"
          [attr.data-state]="option.value === value() ? 'on' : 'off'"
          [tabIndex]="index === tabStop() ? 0 : -1"
          [disabled]="disabled()"
          data-variant="outline"
          data-size="default"
          data-spacing="0"
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

  protected readonly groupClasses: string = SEGMENTED_HELM_CLASSES.group;
  protected readonly itemClasses: string = ITEM_CLASSES;
  /** The option keyboard focus enters on: the checked one, else the first. */
  protected readonly tabStop = computed(() =>
    Math.max(
      0,
      this.options().findIndex((option) => option.value === this.value()),
    ),
  );

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
