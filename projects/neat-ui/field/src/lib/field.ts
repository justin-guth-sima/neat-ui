import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { NeatNote, ɵFIELD_LABEL_CLASSES as FIELD_LABEL_CLASSES } from '@sima/neat-ui';
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
 * The control is the content, inside a `label` whose text is `label`: the label names it, and a
 * click on the name focuses it. One labelable control per field (an `input`, a `textarea`, a native
 * `select`); `neat-select` shows its own name with `showLabel` instead, drawn the same way.
 *
 * `hint` is a note under the control and `error` a `neat-error-note` under that, both outside the
 * label so that they are not part of the control's name. The field describes the control by them
 * (`aria-describedby`) and marks it `aria-invalid` while there is an error, so it owns those two
 * attributes of its control: do not bind them yourself.
 *
 * Lining up in a row: the name's text and the gap under it are `neat-select`'s, and the control's
 * height is its own `size` (`neatInput`, `neat-select` and `neatButton` share `small` and
 * `medium`; `neat-number-field` is `small`). A row of fields and a button of one size aligned at
 * their bottom edge (`align-items: end`) has its names on one baseline and its controls' edges
 * level. A hint or an error makes its field taller, so a row that must stay level shows them under
 * the row instead.
 */
@Component({
  selector: 'neat-field',
  imports: [NeatErrorNote, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-slot': 'field', class: 'flex flex-col gap-(--neat-space-2)' },
  // The rule cannot see a control projected into the label, which is how the label names it.
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label #labelElement [class]="classes.stack">
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

  private readonly labelElement = viewChild.required<ElementRef<HTMLLabelElement>>('labelElement');

  constructor() {
    // The control is the app's element, projected: the field reaches it through the label it sits
    // in (`control` is the label's first labelable descendant) once it is rendered.
    afterRenderEffect(() => {
      const hint = this.hint();
      const error = this.error();
      const control = this.labelElement().nativeElement.control;
      if (!control) return;
      const describedBy = [hint ? this.hintId : '', error ? this.errorId : '']
        .filter(Boolean)
        .join(' ');
      setAttribute(control, 'aria-describedby', describedBy || null);
      setAttribute(control, 'aria-invalid', error ? 'true' : null);
    });
  }
}
