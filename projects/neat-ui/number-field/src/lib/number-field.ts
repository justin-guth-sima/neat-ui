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
import { NeatIcon } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

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
 * from what was typed when it is whole digits, else from `value`. A button that cannot step (at a
 * bound, or while there is no value) is `aria-disabled` and does nothing. Holding a button steps
 * once. The input is then a spinbutton (WAI-ARIA): ArrowUp and ArrowDown step as the buttons do,
 * and the buttons are for the pointer only (no tab stops), so the field stays one tab stop.
 *
 * ```html
 * <neat-number-field label="Frames per second" [showLabel]="false" [value]="rate" [step]="5"
 *   [min]="1" unit="fps" (commit)="setRate($event)" />
 * ```
 *
 * The owner is expected to take what it accepted: after a commit, the field shows that number until
 * `value` changes.
 */
@Component({
  selector: 'neat-number-field',
  imports: [NeatIcon, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label [for]="inputId">
      @if (showLabel()) {
        {{ label() }}
      }
      <span
        class="box"
        [class.shadow-xs]="framed()"
        [attr.data-framed]="framed() ? '' : null"
        [attr.data-steps]="steps() ? '' : null"
      >
        @if (steps()) {
          <button
            type="button"
            class="step"
            tabindex="-1"
            [attr.aria-label]="'Decrease ' + label()"
            [attr.aria-disabled]="canStep(-1) ? null : 'true'"
            [disabled]="disabled()"
            (mousedown)="$event.preventDefault()"
            (click)="stepBy(-1, field)"
          >
            <neat-icon name="minus" [size]="16" />
          </button>
        }
        <input
          #field
          neatInput
          size="small"
          inputmode="numeric"
          [id]="inputId"
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
          (input)="typed(field)"
          (keydown.enter)="commitFrom(field, true)"
          (keydown.arrowup)="arrow($event, 1, field)"
          (keydown.arrowdown)="arrow($event, -1, field)"
          (blur)="commitFrom(field, false)"
        />
        @if (unit()) {
          <span class="unit" [id]="unitId">{{ unit() }}</span>
        }
        @if (steps()) {
          <button
            type="button"
            class="step"
            tabindex="-1"
            [attr.aria-label]="'Increase ' + label()"
            [attr.aria-disabled]="canStep(1) ? null : 'true'"
            [disabled]="disabled()"
            (mousedown)="$event.preventDefault()"
            (click)="stepBy(1, field)"
          >
            <neat-icon name="plus" [size]="16" />
          </button>
        }
      </span>
      <ng-content select="[neatNumberFieldSuffix]" />
    </label>
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
  /** A whole number the user committed, by typing or by a step, that the field and `accept` took. */
  readonly commit = output<number>();

  protected readonly noValue = NO_VALUE;
  protected readonly inputId = `neat-number-field-${++nextFieldId}`;
  protected readonly unitId = `${this.inputId}-unit`;

  /** Whether the field has steps, which make the input a spinbutton. */
  protected readonly steps = computed(() => this.step() !== null);
  /** Whether the box draws the field's look around the input and the parts beside it. */
  protected readonly framed = computed(() => this.steps() || this.unit() !== '');
  /** The least number the field takes. */
  protected readonly floor = computed(() => this.min() ?? 0);
  protected readonly valueText = computed(() => {
    const value = this.value();
    return this.steps() && value !== null && this.unit() ? `${value} ${this.unit()}` : null;
  });
  /** Whether what is typed is a number the field will not take; an emptied field is not. */
  protected readonly invalid = signal(false);

  /** Whether the user typed since the field last showed `value` or committed. */
  protected edited = false;

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // A new value replaces what was typed, which the binding writes into the field.
    effect(() => {
      this.value();
      this.edited = false;
      this.invalid.set(false);
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

  protected typed(field: HTMLInputElement): void {
    this.edited = true;
    this.invalid.set(field.value.trim() !== '' && !this.takes(wholeNumber(field.value)));
  }

  /**
   * Reads the field on Enter (`force`) or on leaving it: commits a number it takes, else shows
   * `value` again. Leaving an untouched field does nothing.
   */
  protected commitFrom(field: HTMLInputElement, force: boolean): void {
    if (!force && !this.edited) return;
    const number = wholeNumber(field.value);
    if (this.takes(number)) this.commitNumber(field, number);
    else this.showValue(field);
  }

  /** Whether the button or arrow key for `direction` steps: not disabled, a value, no bound. */
  protected canStep(direction: 1 | -1): boolean {
    const value = this.value();
    return !this.disabled() && value !== null && this.stepped(value, direction) !== value;
  }

  protected arrow(event: Event, direction: 1 | -1, field: HTMLInputElement): void {
    if (!this.steps()) return;
    event.preventDefault();
    this.stepBy(direction, field);
  }

  /** Commits the number a step from what was typed, if whole digits, else from `value`. */
  protected stepBy(direction: 1 | -1, field: HTMLInputElement): void {
    if (!this.canStep(direction)) return;
    const typed = wholeNumber(field.value);
    const from = Number.isSafeInteger(typed) ? typed : (this.value() as number);
    const next = this.stepped(from, direction);
    if (next !== from && this.takes(next)) this.commitNumber(field, next);
  }

  /** `from` a step in `direction`, held to the field's bounds. */
  private stepped(from: number, direction: 1 | -1): number {
    const next = from + direction * (this.step() ?? 0);
    return Math.min(this.max() ?? Number.POSITIVE_INFINITY, Math.max(this.floor(), next));
  }

  /** Whether the field takes `number`: a whole number within its bounds that `accept` takes. */
  private takes(number: number): boolean {
    const max = this.max();
    return (
      Number.isSafeInteger(number) &&
      number >= this.floor() &&
      (max === null || number <= max) &&
      this.accept()(number)
    );
  }

  private commitNumber(field: HTMLInputElement, number: number): void {
    this.edited = false;
    this.invalid.set(false);
    field.value = String(number);
    this.commit.emit(number);
  }

  private showValue(field: HTMLInputElement): void {
    this.edited = false;
    this.invalid.set(false);
    const value = this.value();
    field.value = value === null ? '' : String(value);
  }
}
