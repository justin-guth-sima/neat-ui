import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from '@angular/core';
import {
  BrnPopover,
  BrnPopoverContent,
  provideBrnPopoverConfig,
  provideBrnPopoverDefaultOptions,
} from '@spartan-ng/brain/popover';
import {
  BrnSelect,
  BrnSelectContent,
  BrnSelectItem,
  BrnSelectList,
  BrnSelectTrigger,
  provideBrnSelectConfig,
} from '@spartan-ng/brain/select';
import { NeatIcon, ɵFIELD_LABEL_CLASSES as FIELD_LABEL_CLASSES, ɵhlm as hlm } from '@sima/neat-ui';

/** `medium` matches the kit's medium input and button (2.25rem), `small` the small ones (2rem). */
export type NeatSelectSize = 'small' | 'medium';
/** Where a shown label sits: over the select, as a field's does, or before it on its row. */
export type NeatSelectLabelPosition = 'above' | 'inline';

/** The kit's sizes in helm's vocabulary: its trigger takes its height from `data-size`. */
const SIZES: Record<NeatSelectSize, 'default' | 'sm'> = { small: 'sm', medium: 'default' };

/** One choice of a `neat-select`. */
export interface NeatSelectOption<T> {
  value: T;
  /** What the option shows, and what a screen reader reads. */
  label: string;
  /** A disabled option is shown but cannot be picked, and the arrow keys skip it. */
  disabled?: boolean;
}

/**
 * Helm's select classes (`lib/ui/select/src/lib/hlm-select-trigger.ts`, `hlm-select-content.ts`
 * and `hlm-select-item.ts`), copied because helm keeps them inline. select.spec checks that each
 * string still appears in the vendored helm, so a helm update that changes one fails until this
 * table is reviewed.
 */
export const SELECT_HELM_CLASSES = {
  trigger:
    'border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 data-[matches-spartan-invalid=true]:ring-destructive/20 dark:data-[matches-spartan-invalid=true]:ring-destructive/40 data-[matches-spartan-invalid=true]:border-destructive dark:data-[matches-spartan-invalid=true]:border-destructive/50 gap-1.5 rounded-md border bg-transparent py-2 ps-2.5 pe-2 text-sm shadow-xs transition-[color,box-shadow] focus-visible:ring-3 data-[matches-spartan-invalid=true]:ring-3 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:gap-1.5 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_neat-icon]:pointer-events-none [&_neat-icon]:shrink-0',
  /** The icon in the trigger, in `hlm-select-trigger.ts`'s template. */
  triggerIcon: 'text-muted-foreground text-[length:--spacing(4)] ms-auto',
  content:
    'bg-popover no-scrollbar text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 max-h-72 min-w-36 flex-col rounded-md shadow-md ring-1 duration-100 relative flex w-(--brn-select-width) overflow-x-hidden overflow-y-auto',
  item: 'data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground gap-2 rounded-sm py-1.5 ps-2 pe-8 text-sm *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 relative flex w-full cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_neat-icon]:pointer-events-none [&_neat-icon]:shrink-0',
  /** The check on the picked item, in `hlm-select-item.ts`'s template. */
  itemCheck: 'absolute end-2 flex items-center justify-center text-[length:--spacing(4)]',
} as const;

/**
 * Where the kit departs from helm's select; each override exists because select.spec failed
 * without it, or for the reason given.
 * - Trigger width: helm's trigger is as wide as its content; the kit's fills its container, as
 *   `neatInput` does, so the app sizes the select by sizing the element around it.
 * - Trigger focus ring and dark fill: as on `neatInput`. Helm's `ring-ring/50` is about 1.85:1 on
 *   white, where a focus indicator needs 3:1, and its dark tint (`--input` at 30%, 50% on hover)
 *   takes the placeholder under 4.5:1.
 * - Panel outline: `--border`, the theme's color for outlines, as on the popover, where helm
 *   draws the text color at 10%.
 */
const TRIGGER_CLASSES = hlm(
  SELECT_HELM_CLASSES.trigger,
  'w-full focus-visible:ring-ring dark:bg-transparent dark:hover:bg-transparent',
);
const CONTENT_CLASSES = hlm(SELECT_HELM_CLASSES.content, 'ring-border');

/**
 * The select's parts by where its label sits, each position taking exactly one set: above, the
 * field's column; inline, one row in which the label keeps its width (it neither wraps nor gives
 * way to the trigger) and the select takes the rest. The label's look is the field label's either
 * way.
 */
const LAYOUTS: Record<NeatSelectLabelPosition, { host: string; label: string; select: string }> = {
  above: { host: FIELD_LABEL_CLASSES.stack, label: FIELD_LABEL_CLASSES.label, select: 'block' },
  inline: {
    host: 'flex items-center gap-2',
    label: hlm(FIELD_LABEL_CLASSES.label, 'shrink-0'),
    select: 'block min-w-0 flex-1',
  },
};

/** The gap between the trigger and the panel, so the panel's outline does not touch the trigger. */
const SIDE_OFFSET = 4;

/** Numbers each `neat-select`, for the id its visible label points at. */
let nextSelectId = 0;

/**
 * A choice of one value from a list, with no free text:
 *
 * ```html
 * <neat-select label="Source" placeholder="Pick a source" [options]="sources" [(value)]="source" />
 * ```
 *
 * `label` is the accessible name of the select and of its list; `showLabel` also shows it above
 * the select, and `labelPosition="inline"` shows it before the select on the same row instead
 * (for a select in a toolbar or a heading); a click on the shown label opens the list. The shown
 * label is drawn as `neat-field`'s is, and `size` matches `neatInput`'s and `neatButton`'s, so a
 * select in a row of fields and buttons of the same size lines up with them. `options` are
 * `{ value, label, disabled? }`; the selected value is `value`, `null` while there is none, and
 * the trigger shows the selected option's label or, without one, `placeholder`; a value that is
 * not among the options (a deleted file, options that load later) shows the placeholder as well,
 * in its muted color. The select fills its container's width (inline, the width its label
 * leaves), and its list is as wide as the select.
 *
 * It follows the WAI-ARIA select-only combobox. On the trigger, Down, Up, Enter and Space open the
 * list; open, Down, Up, Home, End and Page Up and Down move through the options (disabled ones are
 * skipped), typing a few letters jumps to the option whose label starts with them, Enter or Space
 * picks the active option, Tab closes the list and moves on, and Escape closes it without picking.
 * Focus stays on the trigger throughout; `aria-activedescendant` names the active option.
 *
 * Escape is handled here first. An open select takes it, closes, and stops it there: a dialog
 * around the select (or a page shortcut on Escape) never sees the key that closed the list. With
 * the list closed, Escape goes on to whatever is listening. The list is a popup on the overlay
 * layer, above a dialog that holds the select.
 *
 * A component that wraps brain's select rather than hosting it: brain finds its options by content
 * query, so its directives must sit around the options in this template, not on the host element.
 * The popover brain places the list with is the same as the kit's popover uses.
 */
@Component({
  selector: 'neat-select',
  imports: [
    BrnPopover,
    BrnPopoverContent,
    BrnSelect,
    BrnSelectContent,
    BrnSelectItem,
    BrnSelectList,
    BrnSelectTrigger,
    NeatIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideBrnPopoverConfig({ align: 'start', sideOffset: SIDE_OFFSET }),
    provideBrnPopoverDefaultOptions({ role: null }),
    // Brain treats an empty string as "nothing picked"; here only null is, so '' can be a value.
    provideBrnSelectConfig({
      isSingleValuePresent: (value) => value !== null && value !== undefined,
    }),
  ],
  host: { 'data-slot': 'select-field', '[class]': 'layout().host' },
  template: `
    @if (labelShown()) {
      <label [class]="layout().label" [attr.for]="triggerId">{{ label() }}</label>
    }
    <div
      brnSelect
      brnPopover
      #select="brnSelect"
      data-slot="select"
      [class]="layout().select"
      [value]="value()"
      [disabled]="disabled()"
      [itemToString]="labelOf"
      (valueChange)="pick($event)"
      (keydown.escape)="closeOnEscape($event, select)"
    >
      <button
        brnSelectTrigger
        data-slot="select-trigger"
        [attr.data-size]="helmSize()"
        [id]="triggerId"
        [class]="triggerClasses"
        [attr.aria-label]="label()"
      >
        <span
          data-slot="select-value"
          [class.text-muted-foreground]="selectedLabel() === undefined"
          >{{ selectedLabel() ?? placeholder() }}</span
        >
        <neat-icon name="expand" [size]="16" [class]="triggerIconClasses" />
      </button>
      <ng-template brnPopoverContent>
        <div brnSelectContent data-slot="select-content" [class]="contentClasses">
          <div brnSelectList class="flex flex-col" [attr.aria-label]="label()">
            @for (option of options(); track option.value) {
              <div
                brnSelectItem
                #item="brnSelectItem"
                data-slot="select-item"
                [value]="option.value"
                [disabled]="option.disabled ?? false"
                [class]="itemClasses"
              >
                {{ option.label }}
                @if (item.active()) {
                  <neat-icon name="check" [size]="16" aria-hidden="true" [class]="checkClasses" />
                }
              </div>
            }
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
export class NeatSelect<T> {
  /**
   * The accessible name of the select and its list; shown with `showLabel`, or always when
   * `labelPosition` is `inline`.
   */
  readonly label = input.required<string>();
  /** The choices in the order listed, each a value with the label it shows; one may be disabled. */
  readonly options = input.required<readonly NeatSelectOption<T>[]>();
  /** The selected option's value; `null` while there is none. Options are matched with `Object.is`. */
  readonly value = model<T | null>(null);
  /** What the trigger shows while no option is selected. */
  readonly placeholder = input('');
  /** Shows `label` above the select. */
  readonly showLabel = input(false, { transform: booleanAttribute });
  /**
   * Where the label sits: `above` (the default), as a field's and only with `showLabel`, or
   * `inline`, which shows it before the trigger on its row by itself. It is the same `label`
   * element, for the trigger, either way.
   */
  readonly labelPosition = input<NeatSelectLabelPosition>('above');
  /** Turns the whole select off: it cannot be opened or changed. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** The trigger's height: `medium` (2.25rem) or `small` (2rem), as the kit's input and button. */
  readonly size = input<NeatSelectSize>('medium');

  protected readonly layout = computed(() => LAYOUTS[this.labelPosition()]);
  /** Inline is a visible label by definition; above is one only when asked for. */
  protected readonly labelShown = computed(
    () => this.showLabel() || this.labelPosition() === 'inline',
  );
  protected readonly helmSize = computed(() => SIZES[this.size()]);
  protected readonly triggerId = `neat-select-${++nextSelectId}`;
  protected readonly triggerClasses: string = TRIGGER_CLASSES;
  protected readonly triggerIconClasses: string = SELECT_HELM_CLASSES.triggerIcon;
  protected readonly contentClasses: string = CONTENT_CLASSES;
  protected readonly itemClasses: string = SELECT_HELM_CLASSES.item;
  protected readonly checkClasses: string = SELECT_HELM_CLASSES.itemCheck;

  protected readonly selectedLabel = computed(() => this.optionOf(this.value())?.label);

  /** An option's label, which brain's type-ahead matches typed letters against. */
  protected readonly labelOf = (value: T): string => this.optionOf(value)?.label ?? '';

  /** Brain emits only the values of the options it was given. */
  protected pick(value: unknown): void {
    this.value.set(value as T | null);
  }

  private optionOf(value: T | null): NeatSelectOption<T> | undefined {
    return this.options().find((option) => Object.is(option.value, value));
  }

  protected closeOnEscape(event: Event, select: BrnSelect<T>): void {
    if (!select.isExpanded()) return;
    select.close();
    event.stopPropagation();
    event.preventDefault();
  }
}
