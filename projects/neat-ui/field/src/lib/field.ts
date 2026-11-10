import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  ElementRef,
  input,
} from '@angular/core';
import { NeatNote, ɵFIELD_LABEL_CLASSES as FIELD_LABEL_CLASSES } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatErrorNote } from './error-note';

/** Numbers each field, for the ids its hint and error get. */
let nextFieldId = 0;

/** Sets an attribute to a value, or removes it for `null`. */
function setAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

/**
 * A form control under its visible name, with an optional hint and error under it:
 *
 * ```html
 * <neat-field label="Stream URL" hint="RTSP and RTSPS only." [error]="urlError()">
 *   <input neatInput size="small" type="url" />
 * </neat-field>
 * ```
 *
 * The control is the content: one `input neatInput`, inside a `label` whose text is `label`. The
 * label names the control, and a click on the name focuses it. The app may swap the control with an
 * `@if` in the content, and the field follows the control it has. `neat-select` shows its own name
 * with `showLabel` instead, drawn the same way.
 *
 * `hint` is a note under the control, and `error` a `neat-error-note` under that. Both sit outside
 * the label, so they are not part of the control's name.
 *
 * The field describes the control by them (`aria-describedby`), and marks it `aria-invalid` while
 * there is an error. So it owns those two attributes of its control: do not bind them yourself.
 *
 * Fields line up in a row with other controls. The name's text and the gap under it are
 * `neat-select`'s. The control's height is its own `size`: `neatInput`, `neat-select` and
 * `neatButton` share `small` and `medium`, and `neat-number-field` is `small`.
 *
 * Align a row of fields and a button of one size at their bottom edge (`align-items: end`). Its
 * names then sit on one baseline, and its controls' edges are level. A hint or an error makes its
 * field taller, so a row that must stay level shows them under the row instead.
 */
@Component({
  selector: 'neat-field',
  imports: [NeatErrorNote, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'field', class: 'flex flex-col gap-(--neat-space-2)' },
  // The rule cannot see a control projected into the label, which is how the label names it.
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label [class]="classes.stack">
      <span [class]="classes.label">{{ label() }}</span>
      <ng-content />
    </label>
    @if (hint()) {
      <p neatNote [id]="hintId">{{ hint() }}</p>
    }
    @if (error()) {
      <neat-error-note [id]="errorId">{{ error() }}</neat-error-note>
    }
  `,
})
export class NeatField {
  /** The control's visible name. */
  readonly label = input.required<string>();
  /** A note under the control about what it takes; none while empty. */
  readonly hint = input('');
  /** What is wrong with the control's value; none while empty. */
  readonly error = input('');

  protected readonly classes = FIELD_LABEL_CLASSES;
  private readonly id = ++nextFieldId;
  protected readonly hintId = `neat-field-${this.id}-hint`;
  protected readonly errorId = `neat-field-${this.id}-error`;

  /** The control, as a content query: a swapped control is a new value that the effect follows. */
  private readonly control = contentChild(NeatInput, { read: ElementRef });

  constructor() {
    // The control is the app's element, projected; its two attributes are written once it is
    // rendered, and again for a new control, hint or error.
    afterRenderEffect(() => {
      const hint = this.hint();
      const error = this.error();
      const control = this.control()?.nativeElement as HTMLElement | undefined;
      if (!control) return;
      const describedBy = [hint ? this.hintId : '', error ? this.errorId : '']
        .filter(Boolean)
        .join(' ');
      setAttribute(control, 'aria-describedby', describedBy || null);
      setAttribute(control, 'aria-invalid', error ? 'true' : null);
    });
  }
}
