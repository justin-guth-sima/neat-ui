import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { NeatInput } from '../input/input';

/**
 * A small field for one whole number, with its label before it: `<neat-number-field label="Page"
 * [value]="page" [accept]="inRange" (commit)="goTo($event)"><span neatNumberFieldSuffix>of
 * 9</span></neat-number-field>`. It is for jumping to a number, as a page or a channel.
 *
 * The field shows `value`. Typing changes nothing outside until the user commits with Enter or by
 * leaving the field; `commit` then carries the number if it is whole digits that `accept` takes,
 * even when it equals `value`, so an owner can treat a number the user typed as a choice. Anything
 * else puts `value` back in the field and emits nothing. Leaving a field that was not typed in
 * emits nothing, so tabbing past it chooses nothing; Enter always commits what is shown.
 *
 * The owner is expected to take what it accepted: after a commit the field shows that number
 * until `value` changes. Content marked `neatNumberFieldSuffix` follows the input, such as "of 9".
 */
@Component({
  selector: 'neat-number-field',
  imports: [NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label>
      {{ label() }}
      <span class="box">
        <input
          #field
          neatInput
          size="small"
          inputmode="numeric"
          [attr.aria-label]="label()"
          [value]="value()"
          (input)="edited = true"
          (keydown.enter)="commitFrom(field, true)"
          (blur)="commitFrom(field, false)"
        />
      </span>
      <ng-content select="[neatNumberFieldSuffix]" />
    </label>
  `,
  styleUrl: './number-field.css',
})
export class NeatNumberField {
  /** Shown before the input, and its accessible name. */
  readonly label = input.required<string>();
  /** The number the field shows. */
  readonly value = input.required<number>();
  /** Whether the owner takes a whole number; the default takes any. */
  readonly accept = input<(n: number) => boolean>(() => true);
  /** A whole number the user committed and `accept` took. */
  readonly commit = output<number>();

  /** Whether the user typed since the field last showed `value` or committed. */
  protected edited = false;

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // A new value replaces what was typed, which the binding writes into the field.
    effect(() => {
      this.value();
      this.edited = false;
    });
  }

  /**
   * Focuses the input with its number selected, so what the user types replaces it: for a
   * shortcut that jumps to the field, such as "g" for the page.
   */
  focus(): void {
    const field = this.field().nativeElement;
    field.focus();
    field.select();
  }

  /**
   * Reads the field on Enter (`force`) or on leaving it: commits an accepted whole number, else
   * shows `value` again. Leaving an untouched field does nothing.
   */
  protected commitFrom(field: HTMLInputElement, force: boolean): void {
    if (!force && !this.edited) return;
    this.edited = false;
    const typed = field.value.trim();
    const number = /^\d+$/.test(typed) ? Number(typed) : Number.NaN;
    if (Number.isSafeInteger(number) && this.accept()(number)) {
      field.value = String(number);
      this.commit.emit(number);
    } else {
      field.value = String(this.value());
    }
  }
}
