import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DocsToken } from './model';
import { TypeText } from './type-text';

/**
 * Source as the generator's runs, each coloured by its kind; they spell the file again, so they
 * can sit in a pre. Every text is its own node, so the template adds no space between runs.
 */
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (run of runs(); track $index) {
      @if (run[0] === 'text') {
        <ng-container>{{ run[1] }}</ng-container>
      } @else {
        <span [class]="run[0]">{{ run[1] }}</span>
      }
    }
  `,
  styleUrl: './runs.css',
})
export class Runs {
  readonly runs = input.required<readonly DocsToken[]>();
}

/**
 * The docs' one code surface: a doc comment's fence, a signature or definition (`linked`, its
 * documented names links), an import line, an example's file (`runs`). Elements marked
 * `codeBoxEnd` sit at its end, beside the code (the import line's copy button).
 *
 * `overflow` is `wrap` for short code (a usage line, a union, in a narrow panel, where a box that
 * scrolls inside a panel that scrolls would be one too many) and `scroll` for a whole file, whose
 * lines keep their shape.
 */
@Component({
  selector: 'app-code-box',
  imports: [Runs, TypeText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Nothing but the code inside each pre, whose whitespace is shown.
  template: `
    @if (runs(); as runs) {
      <pre [attr.data-overflow]="overflow()"><code><app-runs [runs]="runs" /></code></pre>
    } @else if (linked()) {
      <pre [attr.data-overflow]="overflow()"><app-type-text [text]="code()" /></pre>
    } @else {
      <pre [attr.data-overflow]="overflow()">{{ code() }}</pre>
    }
    <ng-content select="[codeBoxEnd]" />
  `,
  styleUrl: './code-box.css',
})
export class CodeBox {
  /** The code as text, when there are no `runs`. */
  readonly code = input('');
  /** A file as the generator's coloured runs, in place of `code`. */
  readonly runs = input<readonly DocsToken[] | null>(null);
  readonly linked = input(false, { transform: booleanAttribute });
  readonly overflow = input<'wrap' | 'scroll'>('wrap');
}
