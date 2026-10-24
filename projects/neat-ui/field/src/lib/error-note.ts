import { ChangeDetectionStrategy, Component } from '@angular/core';

/*
 * Class strings stay literals: Tailwind finds the classes the kit stylesheet needs by reading
 * them. The text is the theme's `--destructive`, which it holds to 4.5:1 on every surface.
 */
const ERROR_NOTE_CLASSES =
  'block text-destructive text-(length:--neat-text-sm) whitespace-pre-line wrap-anywhere';

/**
 * A failure said in place, under the form or the work it belongs to:
 * `<neat-error-note>{{ message }}</neat-error-note>`. It is an `alert`, so a screen reader reads
 * it as it appears: render it when there is a failure (`@if`), not as an empty note waiting for
 * one. A message of several lines (a server's diagnostics) keeps its line breaks, and a long
 * unbroken string (a URL) wraps rather than widen the form. The words are the app's.
 *
 * `neat-field` shows one under its control for its `error`.
 */
@Component({
  selector: 'neat-error-note',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'alert', 'data-slot': 'error-note', class: ERROR_NOTE_CLASSES },
  template: '<ng-content />',
})
export class NeatErrorNote {}
