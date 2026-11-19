import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NeatCopyButton } from './copy-button';

/**
 * What a code block does with a line wider than itself: `wrap` breaks it, `scroll` keeps it whole
 * and scrolls the block sideways.
 */
export type NeatCodeOverflow = 'wrap' | 'scroll';

/**
 * Code set apart on the muted fill, as written, with an optional Copy button at its end.
 *
 * ```html
 * <neat-code-block [code]="command" copy="install command" />
 * ```
 *
 * For a command to run, a file to paste or a URL to copy. For a name or a path in running text,
 * use `code[neatCode]` instead.
 *
 * `copy` names what the code is and adds a `NeatCopyButton` beside the code. "install command"
 * names the button "Copy install command". Without `copy` the block has no button.
 *
 * `overflow` is `wrap` by default, for short code such as a command, which then breaks anywhere.
 * Use `scroll` for a whole file, whose lines keep their shape and scroll sideways.
 *
 * The code is plain text in the kit's monospace font, with no syntax colors. An app that colors
 * its code (spans from a highlighter run at build time) puts them inside the element. They are
 * shown in place of `code`, which stays what Copy copies, so they must spell the same text:
 *
 * ```html
 * <neat-code-block [code]="source" copy="app.ts">
 *   @for (run of runs; track $index) {
 *     <span [class]="run.kind">{{ run.text }}</span>
 *   }
 * </neat-code-block>
 * ```
 *
 * Angular leaves out the line breaks between a template's elements, so only the spans' own text
 * shows, as written.
 */
@Component({
  selector: 'neat-code-block',
  imports: [NeatCopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Nothing but the code inside the pre, whose whitespace is shown.
  template: `
    <pre [attr.data-overflow]="overflow()"><code><ng-content>{{ code() }}</ng-content></code></pre>
    @if (copy(); as what) {
      <neat-copy-button [text]="code()" [what]="what" />
    }
  `,
  styleUrl: './code-block.css',
})
export class NeatCodeBlock {
  /** The code, as text: shown, and copied by the Copy button. */
  readonly code = input.required<string>();
  /** What the code is, which adds a Copy button named after it ("Copy install command"). */
  readonly copy = input<string>();
  /** Whether a long line wraps or scrolls sideways (a `NeatCodeOverflow`). */
  readonly overflow = input<NeatCodeOverflow>('wrap');
}
