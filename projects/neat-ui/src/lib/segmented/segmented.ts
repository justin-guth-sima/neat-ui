import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { BrnToggleGroup, BrnToggleGroupItem } from '@spartan-ng/brain/toggle-group';
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
 * A segment as a radio: brain's toggle-group item toggles it and marks it `data-state`, while
 * `aria-pressed`, which a radio does not take, is removed (a directive's own host bindings apply
 * after its host directives').
 */
@Directive({
  selector: 'button[neatSegmentedItem]',
  hostDirectives: [{ directive: BrnToggleGroupItem, inputs: ['value'] }],
  host: { role: 'radio', '[attr.aria-pressed]': 'null' },
})
class NeatSegmentedItem {}

/**
 * A row of mutually exclusive choices, such as a tile shape: `<neat-segmented label="Tile shape"
 * [options]="shapes" [(value)]="shape" />`. It is a radio group named by `label`: one tab stop
 * (the checked option), arrow keys move the choice and wrap, Home and End jump to the ends, and a
 * click on the checked option keeps it checked.
 *
 * Brain's toggle group holds the choice; it sits inside the template rather than on the host
 * because a host directive's inputs cannot be fixed, and the group must not allow deselecting.
 * Brain's group is a `group` of pressed buttons with no arrow keys, so the radio roles, the roving
 * tab stop and the keys are the kit's.
 */
@Component({
  selector: 'neat-segmented',
  imports: [BrnToggleGroup, NeatSegmentedItem, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <div
      brnToggleGroup
      [nullable]="false"
      [value]="value()"
      [disabled]="disabled()"
      (valueChange)="choose($event)"
      [attr.role]="'radiogroup'"
      [attr.aria-label]="label()"
      data-variant="outline"
      data-spacing="0"
      data-orientation="horizontal"
      [class]="groupClasses"
      (keydown)="move($event)"
    >
      @for (option of options(); track option.value; let index = $index) {
        <button
          neatSegmentedItem
          [value]="option.value"
          [attr.aria-checked]="option.value === value()"
          [tabIndex]="index === tabStop() ? 0 : -1"
          data-variant="outline"
          data-size="default"
          data-spacing="0"
          [class]="itemClasses"
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

  protected readonly groupClasses = SEGMENTED_HELM_CLASSES.group;
  protected readonly itemClasses = ITEM_CLASSES;
  /** The option keyboard focus enters on: the checked one, else the first. */
  protected readonly tabStop = computed(() =>
    Math.max(
      0,
      this.options().findIndex((option) => option.value === this.value()),
    ),
  );

  private readonly buttons = viewChildren(NeatSegmentedItem, { read: ElementRef });

  /**
   * Brain's group reports a list in multiple mode and null or undefined without a choice; in
   * single mode with deselection off, as here, a change is always one of the options' values.
   */
  protected choose(value: T | T[] | null | undefined): void {
    this.value.set(value as T);
  }

  protected move(event: KeyboardEvent): void {
    const next = MOVES[event.key];
    const options = this.options();
    if (!next || this.disabled() || !options.length) return;
    event.preventDefault();
    const buttons = this.buttons().map((button) => button.nativeElement as HTMLElement);
    const current = buttons.indexOf(event.target as HTMLElement);
    const index = next(current < 0 ? this.tabStop() : current, options.length);
    this.value.set(options[index].value);
    buttons[index]?.focus();
  }
}
