import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ɵhlm as hlm } from '@sima/neat-ui';
import { FIELD_HELM_CLASSES } from './field-classes';

/*
 * Helm's field error (destructive, small), which the theme holds to 4.5:1 on every surface, and
 * the kit's own handling of a message: its line breaks kept, a long word wrapped.
 */
const ERROR_NOTE_CLASSES = hlm(
  'block',
  FIELD_HELM_CLASSES.error,
  'whitespace-pre-line wrap-anywhere',
);

/**
 * A failure said in place, under the form or the work it belongs to.
 *
 * ```html
 * @if (error(); as message) {
 *   <neat-error-note>{{ message }}</neat-error-note>
 * }
 * ```
 *
 * It is an `alert`, so a screen reader reads it as it appears. Render it when there is a failure
 * (`@if`), not as an empty note waiting for one.
 *
 * A message of several lines, such as a server's diagnostics, keeps its line breaks. A long
 * unbroken string, such as a URL, wraps rather than widen the form. The words are the app's.
 *
 * `neat-field` shows one under its control for its `error`.
 */
@Component({
  selector: 'neat-error-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', 'data-slot': 'error-note', '[class]': 'classes' },
  template: '<ng-content />',
})
export class NeatErrorNote {
  protected readonly classes = ERROR_NOTE_CLASSES;
}
