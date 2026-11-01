import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TypeText } from './type-text';

/**
 * Code shown as a box of its own lines: a doc comment's fence, a function's signature, a type's
 * definition. `linked` makes its documented names links, for code that is type text.
 */
@Component({
  selector: 'app-code-box',
  imports: [TypeText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Nothing but the code inside each pre, whose whitespace is shown.
  template: `
    @if (linked()) {
      <pre><app-type-text [text]="code()" /></pre>
    } @else {
      <pre>{{ code() }}</pre>
    }
  `,
  styleUrl: './code-box.css',
})
export class CodeBox {
  readonly code = input.required<string>();
  readonly linked = input(false, { transform: booleanAttribute });
}
