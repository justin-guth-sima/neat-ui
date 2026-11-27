import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  type NeatFieldWidth,
  NeatIcon,
  ɵFIELD_WIDTH_CLASSES as FIELD_WIDTH_CLASSES,
  ɵhlm as hlm,
  ɵINPUT_CLASSES as INPUT_CLASSES,
  ɵINPUT_HELM_CLASSES as INPUT_HELM_CLASSES,
} from '@sima/neat-ui';

/**
 * Helm's input-group classes (`lib/ui/input-group/src/lib/hlm-input-group*.ts`), copied because
 * helm keeps them inline: the group is the field's frame, an addon at each end holds a step, the
 * unit is the group's text and the input its control. number-field.spec checks that each string
 * still appears in the vendored helm, so a helm update that changes one fails until this table is
 * reviewed.
 */
export const INPUT_GROUP_HELM_CLASSES = {
  /** `hlm-input-group.ts`. */
  group:
    'border-input dark:bg-input/30 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][data-matches-spartan-invalid=true]]:ring-destructive/20 has-[[data-slot][data-matches-spartan-invalid=true]]:border-destructive dark:has-[[data-slot][data-matches-spartan-invalid=true]]:ring-destructive/40 h-9 rounded-md border shadow-xs transition-[color,box-shadow] in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][data-matches-spartan-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=inline-end]]:[&>input]:pe-1.5 has-[>[data-align=inline-start]]:[&>input]:ps-1.5 group/input-group relative flex w-full min-w-0 items-center outline-none has-[>textarea]:h-auto',
  /** `hlm-input-group-addon.ts`: every addon's classes. */
  addonBase:
    "text-muted-foreground h-auto gap-2 py-1.5 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] flex cursor-text items-center justify-center select-none",
  /** `hlm-input-group-addon.ts`: an addon at each end, by its `align`. */
  addon: {
    'inline-start': 'ps-2 has-[>button]:-ms-1 has-[>kbd]:ms-[-0.15rem] order-first',
    'inline-end': 'pe-2 has-[>button]:-me-1 has-[>kbd]:me-[-0.15rem] order-last',
  },
  /** `hlm-input-group-input.ts`: the input, over helm's input classes. */
  input:
    'rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 data-[matches-spartan-invalid=true]:ring-0 dark:bg-transparent flex-1',
  /** `hlm-input-group-text.ts`. */
  text: "text-muted-foreground gap-2 text-sm [&_neat-icon:not([class*='text-'])]:text-[length:--spacing(4)] flex items-center [&_neat-icon]:pointer-events-none",
} as const;

/**
 * Where the kit departs from helm's input group, the frame keeping the input's two fixes
 * (`neatInput`'s, from input-classes in the primary) and its small height:
 * - Focus ring: helm's `ring-ring/50` is about 1.85:1 on white, where a focus indicator needs
 *   3:1; the frame draws full `--ring`, which the theme holds to it.
 * - Dark fill: helm tints the group with `--input` at 30%, which takes the placeholder to 4.2:1 on
 *   a card. The frame stays transparent as in light; its border marks it at 3:1 or more.
 * - Height: the kit's small field, `h-8` (2rem), where helm's group is `h-9`; the input fills it.
 * - The unit stands in the group, outside an addon, so the number and its unit stay together;
 *   it fades with the group as an addon does.
 * - Figures in tabular digits, so a stepped number keeps its width.
 * - No roles: helm makes the group and each addon a `group`, but the input is the field's one
 *   control, named by its label, and the steps are for the pointer only, so the groups would only
 *   add unnamed levels around them. Their `data-slot` and `data-align` stay, which helm's classes
 *   select on.
 */
const GROUP_CLASSES = hlm(
  INPUT_GROUP_HELM_CLASSES.group,
  'h-8 has-[[data-slot=input-group-control]:focus-visible]:ring-ring dark:bg-transparent',
);
const ADDON_CLASSES = {
  start: hlm(INPUT_GROUP_HELM_CLASSES.addonBase, INPUT_GROUP_HELM_CLASSES.addon['inline-start']),
  end: hlm(INPUT_GROUP_HELM_CLASSES.addonBase, INPUT_GROUP_HELM_CLASSES.addon['inline-end']),
} as const;
const GROUP_INPUT_CLASSES = hlm(
  INPUT_HELM_CLASSES,
  INPUT_GROUP_HELM_CLASSES.input,
  'h-full tabular-nums',
);
const UNIT_CLASSES = hlm(
  INPUT_GROUP_HELM_CLASSES.text,
  'group-data-[disabled=true]/input-group:opacity-50',
);

/**
 * The field's parts at each width. `fill` takes its container's width, the box the room the label
 * and suffix leave. `content` is as wide as its parts, and no wider or narrower in a crowded row:
 * the frame as wide as the number and its unit, and the plain field room for a page or channel
 * number, 3rem.
 */
const WIDTHS: Record<NeatFieldWidth, { host: string; frame: string; plain: string }> = {
  fill: {
    host: hlm(FIELD_WIDTH_CLASSES.fill, 'min-w-0'),
    frame: hlm(GROUP_CLASSES, FIELD_WIDTH_CLASSES.fill),
    plain: hlm('flex min-w-0', FIELD_WIDTH_CLASSES.fill),
  },
  content: {
    host: hlm(FIELD_WIDTH_CLASSES.content, 'flex-none'),
    frame: hlm(GROUP_CLASSES, FIELD_WIDTH_CLASSES.content),
    plain: 'flex w-12',
  },
};

/** What the empty field shows while there is no value, the kit's text for "no figure". */
const NO_VALUE = '–';

let nextFieldId = 0;

/** The number in `text` if it is whole digits, else `NaN`. */
function wholeNumber(text: string): number {
  const typed = text.trim();
  return /^\d+$/.test(typed) ? Number(typed) : Number.NaN;
}

/**
 * A small field for one whole number, for jumping to a number such as a page or a channel, or for
 * a setting stepped up and down such as a frame rate.
 *
 * ```html
 * <neat-number-field label="Page" [value]="page" [accept]="inRange" (commit)="goTo($event)">
 *   <span neatNumberFieldSuffix>of 9</span>
 * </neat-number-field>
 * ```
 *
 * Its label sits before it; `showLabel` false hides it where a heading already names the field,
 * and it stays the input's accessible name. Content marked `neatNumberFieldSuffix` follows the
 * field, such as "of 9". A `unit` ("fps") sits inside the field's box, after the number.
 *
 * It fills its container's width, its box the room the label and suffix leave. `width="content"`
 * sizes the box to its number and unit (room for a page or channel number without a unit), for a
 * field in a toolbar or beside a heading.
 *
 * The field shows `value`, or an empty field with "–" while `value` is null. Typing changes nothing
 * outside until the user commits, with Enter or by leaving the field. `commit` then carries the
 * number if it is whole digits within `min` and `max` that `accept` takes. It does so even when the
 * number equals `value`, so an owner can treat a number the user typed as a choice. Anything else
 * puts `value` back in the field and emits nothing; while it is typed, the input is
 * `aria-invalid`.
 *
 * Leaving a field that was not typed in emits nothing, so tabbing past it chooses nothing. Enter
 * always commits what is shown.
 *
 * With `step`, a − button at the box's start and a + button at its end commit the number one step
 * down or up at once, held to `min` and `max` (3 less a step of 5 is 1 with `min` 1). They step
 * from what was typed when it is whole digits within the bounds, else from `value`, so + and −
 * always move the number shown the way they say. A button that cannot step (at a bound, or with no
 * number shown) is `aria-disabled` and does nothing. Holding a button steps once. The input is then
 * a spinbutton (WAI-ARIA): ArrowUp and ArrowDown step as the buttons do, and the buttons are for
 * the pointer only (no tab stops), so the field stays one tab stop.
 *
 * ```html
 * <neat-number-field label="Frames per second" [showLabel]="false" [value]="rate" [step]="5"
 *   [min]="1" unit="fps" (commit)="setRate($event)" />
 * ```
 *
 * The owner is expected to take what it accepted: after a commit, the field shows that number until
 * `value` changes. An owner that refuses a committed number, and so keeps `value` as it was, calls
 * `reset()` to show `value` again.
 */
@Component({
  selector: 'neat-number-field',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'widthClasses().host', '[attr.data-width]': 'width()' },
  template: `
    @if (showLabel()) {
      <label [for]="inputId">{{ label() }}</label>
    }
    <span
      class="box"
      [class]="framed() ? widthClasses().frame : widthClasses().plain"
      [attr.data-slot]="framed() ? 'input-group' : null"
      [attr.data-disabled]="framed() && disabled() ? 'true' : null"
      [attr.data-framed]="framed() ? '' : null"
      [attr.data-steps]="steps() ? '' : null"
      (mousedown)="boxPress($event, field)"
    >
      @if (steps()) {
        <span data-slot="input-group-addon" data-align="inline-start" [class]="addonClasses.start">
          <button
            type="button"
            class="step"
            tabindex="-1"
            [attr.aria-label]="'Decrease ' + label()"
            [attr.aria-disabled]="stalled(-1) ? 'true' : null"
            [disabled]="disabled()"
            (click)="stepBy(-1, field)"
          >
            <neat-icon name="minus" [size]="16" />
          </button>
        </span>
      }
      <input
        #field
        inputmode="numeric"
        [attr.data-slot]="framed() ? 'input-group-control' : 'input'"
        [id]="inputId"
        [class]="framed() ? groupInputClasses : fieldClasses"
        [attr.aria-label]="label()"
        [attr.role]="steps() ? 'spinbutton' : null"
        [attr.aria-valuenow]="steps() ? value() : null"
        [attr.aria-valuemin]="steps() ? floor() : null"
        [attr.aria-valuemax]="steps() ? max() : null"
        [attr.aria-valuetext]="valueText()"
        [attr.aria-describedby]="unit() && !steps() ? unitId : null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.placeholder]="value() === null ? noValue : null"
        [disabled]="disabled()"
        [value]="value()"
        (input)="draft.set(field.value)"
        (keydown.enter)="commitFrom(field, true)"
        (keydown.arrowup)="arrow($event, 1, field)"
        (keydown.arrowdown)="arrow($event, -1, field)"
        (blur)="commitFrom(field, false)"
      />
      @if (unit()) {
        <span class="unit" [class]="unitClasses" [id]="unitId">{{ unit() }}</span>
      }
      @if (steps()) {
        <span data-slot="input-group-addon" data-align="inline-end" [class]="addonClasses.end">
          <button
            type="button"
            class="step"
            tabindex="-1"
            [attr.aria-label]="'Increase ' + label()"
            [attr.aria-disabled]="stalled(1) ? 'true' : null"
            [disabled]="disabled()"
            (click)="stepBy(1, field)"
          >
            <neat-icon name="plus" [size]="16" />
          </button>
        </span>
      }
    </span>
    <ng-content select="[neatNumberFieldSuffix]" />
  `,
  styleUrl: './number-field.css',
})
export class NeatNumberField {
  /** Shown before the input unless `showLabel` is false, and its accessible name either way. */
  readonly label = input.required<string>();
  /** The number the field shows; null while there is none, shown as an empty field with "–". */
  readonly value = input.required<number | null>();
  /** Whether the owner takes a whole number within `min` and `max`; the default takes any. */
  readonly accept = input<(n: number) => boolean>(() => true);
  /**
   * How far the − and + buttons and the arrow keys move the number, a positive whole number; null
   * (the default) for a field without steps.
   */
  readonly step = input<number | null>(null);
  /**
   * The least number the field takes, typed or stepped; null (the default) for 0, the least whole
   * number.
   */
  readonly min = input<number | null>(null);
  /** The greatest number the field takes, typed or stepped; null (the default) for no limit. */
  readonly max = input<number | null>(null);
  /** What the number counts ("fps"), shown inside the box after it; none by default. */
  readonly unit = input('');
  /** Whether the label is shown before the field; false where a heading names it already. */
  readonly showLabel = input(true, { transform: booleanAttribute });
  /** Turns the field off: the input and both buttons are disabled and nothing commits. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /**
   * How wide it is: `fill` (the default), its container's width, or `content`, its box as wide as
   * its number and unit.
   */
  readonly width = input<NeatFieldWidth>('fill');
  /** A whole number the user committed, by typing or by a step, that the field and `accept` took. */
  readonly commit = output<number>();

  protected readonly noValue = NO_VALUE;
  /** The kit's small text field, or, in a frame, the group's input, addons and unit. */
  protected readonly fieldClasses: string = INPUT_CLASSES.small;
  protected readonly groupInputClasses: string = GROUP_INPUT_CLASSES;
  protected readonly addonClasses = ADDON_CLASSES;
  protected readonly unitClasses: string = UNIT_CLASSES;
  protected readonly widthClasses = computed(() => WIDTHS[this.width()]);
  protected readonly inputId = `neat-number-field-${++nextFieldId}`;
  protected readonly unitId = `${this.inputId}-unit`;

  /** Whether the field has steps, which make the input a spinbutton. */
  protected readonly steps = computed(() => this.step() !== null);
  /** Whether the box is the field's frame, helm's input group, around the input and its parts. */
  protected readonly framed = computed(() => this.steps() || this.unit() !== '');
  /** The least number the field takes. */
  protected readonly floor = computed(() => this.min() ?? 0);
  protected readonly valueText = computed(() => {
    const value = this.value();
    return this.steps() && value !== null && this.unit() ? `${value} ${this.unit()}` : null;
  });
  /** What the user typed since the field last showed `value` or committed; null if nothing. */
  protected readonly draft = signal<string | null>(null);
  /** Whether what is typed is a number the field will not take; an emptied field is not. */
  protected readonly invalid = computed(() => {
    const draft = this.draft();
    return draft !== null && draft.trim() !== '' && !this.takes(wholeNumber(draft));
  });
  /**
   * The number the steps start from: what was typed when it is whole digits within the bounds, else
   * `value`.
   */
  private readonly shown = computed(() => {
    const typed = wholeNumber(this.draft() ?? '');
    return this.inBounds(typed) ? typed : this.value();
  });

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // A new value replaces what was typed, which the binding writes into the field.
    effect(() => {
      this.value();
      this.draft.set(null);
    });
  }

  /**
   * Focuses the input with its number selected, so what the user types replaces it.
   *
   * Call it from a shortcut that jumps to the field, such as "g" for the page.
   */
  focus(): void {
    const field = this.field().nativeElement;
    field.focus();
    field.select();
  }

  /**
   * Shows `value` again and drops what was typed, with its invalid mark.
   *
   * For an owner that refused a number the field committed (a server that will not take 500 fps):
   * its `value` stays as it was, so the field would keep showing the refused number until `value`
   * changes.
   */
  reset(): void {
    this.showValue(this.field().nativeElement);
  }

  /**
   * Reads the field on Enter (`force`) or on leaving it: commits a number it takes, else shows
   * `value` again. Leaving an untouched field does nothing.
   */
  protected commitFrom(field: HTMLInputElement, force: boolean): void {
    if (!force && this.draft() === null) return;
    const number = wholeNumber(field.value);
    if (this.takes(number)) this.commitNumber(field, number);
    else this.showValue(field);
  }

  /**
   * Whether the button or arrow key for `direction` steps: the field is on, it shows a number (typed
   * or `value`), and that number is not at the bound.
   */
  protected canStep(direction: 1 | -1): boolean {
    const from = this.shown();
    return !this.disabled() && from !== null && this.stepped(from, direction) !== from;
  }

  /**
   * Whether a step button is `aria-disabled`: it cannot step while the field is on. A disabled
   * field's buttons are `disabled`, which dims them with the frame, so they carry no mark.
   */
  protected stalled(direction: 1 | -1): boolean {
    return !this.disabled() && !this.canStep(direction);
  }

  /**
   * A press on the box that is not on the input focuses the input, so the unit, the padding and the
   * room beside the number act as the field they look like. The default is kept from moving the
   * focus elsewhere, which a step button also needs: it steps without taking the focus.
   */
  protected boxPress(event: MouseEvent, field: HTMLInputElement): void {
    if (event.target === field) return;
    event.preventDefault();
    if (!(event.target as Element).closest('.step')) field.focus();
  }

  protected arrow(event: Event, direction: 1 | -1, field: HTMLInputElement): void {
    if (!this.steps()) return;
    event.preventDefault();
    this.stepBy(direction, field);
  }

  /** Commits the number a step from what was typed, if whole digits, else from `value`. */
  protected stepBy(direction: 1 | -1, field: HTMLInputElement): void {
    if (!this.canStep(direction)) return;
    const next = this.stepped(this.shown() as number, direction);
    if (this.takes(next)) this.commitNumber(field, next);
  }

  /** `from` a step in `direction`, held to the field's bounds. */
  private stepped(from: number, direction: 1 | -1): number {
    const next = from + direction * (this.step() ?? 0);
    return Math.min(this.max() ?? Number.POSITIVE_INFINITY, Math.max(this.floor(), next));
  }

  /** Whether `number` is a whole number within the field's bounds. */
  private inBounds(number: number): boolean {
    const max = this.max();
    return (
      Number.isSafeInteger(number) && number >= this.floor() && (max === null || number <= max)
    );
  }

  /** Whether the field takes `number`: a whole number within its bounds that `accept` takes. */
  private takes(number: number): boolean {
    return this.inBounds(number) && this.accept()(number);
  }

  private commitNumber(field: HTMLInputElement, number: number): void {
    this.draft.set(null);
    field.value = String(number);
    this.commit.emit(number);
  }

  private showValue(field: HTMLInputElement): void {
    this.draft.set(null);
    const value = this.value();
    field.value = value === null ? '' : String(value);
  }
}
