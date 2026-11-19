import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { NeatCopyButton } from './copy-button';
import { highlighterFor } from './highlighter';
import { NEAT_CODE_LANGUAGES } from './languages';
import { plainLines } from './lines';

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
 * `language` colors the code in the theme's code colors:
 *
 * ```html
 * <neat-code-block [code]="source" language="python" copy="example" overflow="scroll" />
 * ```
 *
 * The block colors Python, C++, C, shell, JSON, YAML, CMake, TypeScript, JavaScript, HTML, CSS,
 * Markdown, Dockerfile and Go by themselves; `provideNeatCodeLanguages` adds others. The
 * highlighter (Shiki) and each language's grammar load the first time a block on the page shows
 * that language, so a page without a colored block loads none of it, and one with Python only
 * never loads C++. While they load, the block shows the code plain, in the same layout. A
 * language the block does not know leaves the code plain and is named once in dev mode.
 *
 * `lineNumbers` numbers the lines in a gutter at their start. The numbers are not part of the text:
 * a selection leaves them out, a screen reader does not read them, and Copy copies the code as
 * given, colored or not.
 *
 * An app that colors its code itself (spans from a highlighter run at build time) puts them
 * inside the element. They are shown in place of the block's own lines, without `language` or
 * `lineNumbers`, and `code` stays what Copy copies, so they must spell the same text:
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
  // Nothing but the code inside the pre, whose whitespace is shown: one element per line, its runs
  // inside it and its line break last, so the lines' text is the code as given.
  template: `
    <pre
      [attr.data-overflow]="overflow()"
      [attr.data-line-numbers]="lineNumbers() || null"
      [style.--line-number-digits]="digits()"
    ><code><ng-content>@for (line of lines(); track $index) {<span class="line">@for (run of line.runs; track $index) {<span [attr.data-kind]="run.kind">{{ run.text }}</span>}{{ line.end }}</span>}</ng-content></code></pre>
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
  /**
   * The language the code is in, by its Shiki name or an alias (`"python"`, `"cpp"`, `"bash"`),
   * which colors it; `null`, the default, shows it plain.
   */
  readonly language = input<string | null>(null);
  /** Whether the lines are numbered, in a gutter that a selection and Copy leave out. */
  readonly lineNumbers = input(false);

  /** The languages the block colors: its own, and those the app added (which win). */
  private readonly languages = inject(NEAT_CODE_LANGUAGES);

  private readonly highlighter = resource({
    params: () => this.language() ?? undefined,
    loader: ({ params: language }) => highlighterFor(language, this.languages),
  });

  /** The lines shown: colored once the language's highlighter is there, plain until then. */
  protected readonly lines = computed(() => {
    const highlighter = this.highlighter.hasValue() ? this.highlighter.value() : undefined;
    return highlighter ? highlighter.lines(this.code()) : plainLines(this.code());
  });

  /** How many digits the last line's number has, which sets the gutter's width. */
  protected readonly digits = computed(() => String(this.lines().length).length);
}
