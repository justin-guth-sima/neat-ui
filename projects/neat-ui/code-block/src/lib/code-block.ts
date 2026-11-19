import { NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  resource,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatIcon, ɵreducedMotion as reducedMotion } from '@sima/neat-ui';
import { NeatCopyButton } from './copy-button';
import { highlighterFor } from './highlighter';
import { NEAT_CODE_LANGUAGES } from './languages';
import { plainLines } from './lines';
import { focusLines, type NeatCodeMark, type NeatCodeStep } from './marks';
import { scrollToShow } from './scroll';

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
 * `marks` sets lines, or parts of lines, apart, and dims the rest of the code. A `NeatCodeMark`
 * counts lines and columns from 1, as `lineNumbers` numbers them:
 *
 * ```html
 * <neat-code-block [code]="source" language="cpp" [marks]="marks" />
 * ```
 *
 * ```ts
 * readonly marks: NeatCodeMark[] = [{ lines: [4, 6] }, { line: 9, text: 'model.run' }];
 * ```
 *
 * A marked line gets a band across the block, and a marked part a rounded marker behind it, both
 * in the theme's mark tint (`--neat-code-mark`). Marked code keeps its colors, each held to 4.5:1
 * on the tint. The rest dims to the muted text color, which still reads at 4.5:1 on the block.
 * `[dim]="false"` leaves the rest as it is.
 *
 * A marked part is a `mark` element, which a screen reader announces as highlighted. Marks change
 * nothing of the text: a selection and Copy take the code as given. A mark that names no line, or
 * text its line does not have, throws in dev mode and is left out in production.
 *
 * `steps` walks through the code a set of marks at a time, each a `NeatCodeStep` with an optional
 * `label`. `step` is the one shown, from 0. Bind it both ways to show a note of your own beside
 * the block:
 *
 * ```html
 * <neat-code-block [code]="source" [steps]="walk" [(step)]="at" stepControls />
 * <p>{{ walk[at()].note }}</p>
 * ```
 *
 * While a block has steps, it shows their marks and does not use `marks`. A `step` outside the
 * steps shows the nearest one and is left as it is. `stepControls` adds a Previous and a Next
 * button and the position ("2 of 5") below the code.
 *
 * A block with steps is a tab stop, and the left and right arrow keys move to the step before and
 * after. On the code itself, which is a tab stop of its own while it scrolls sideways, they scroll
 * it instead. Moving to a step fades its marks in as the last ones fade out, at once under reduced
 * motion. A polite live region says the step ("Step 2 of 5: Open the camera").
 *
 * The block scrolls its own box, never the page, to bring the first mark into view when the marks
 * shown change. Give the block a height or a `max-height`, and its code scrolls inside it: a long
 * file then walks to a mark further down without moving the page.
 *
 * An app that colors its code itself (spans from a highlighter run at build time) puts them
 * inside the element. They are shown in place of the block's own lines, without `language`,
 * `lineNumbers` or marks, and `code` stays what Copy copies, so they must spell the same text. The
 * steps, their controls and the keys still work, so the app can mark its own spans by `step`:
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
  imports: [NeatButton, NeatCopyButton, NeatIcon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.tabindex]': 'stepCount() ? 0 : null',
    '[attr.role]': 'stepCount() ? "group" : null',
    '[attr.aria-label]': 'stepCount() ? "Code in steps" : null',
    '(keydown)': 'onKeydown($event)',
  },
  // Nothing but the code inside the pre, whose whitespace is shown: one element per line, its
  // pieces inside it (runs, or runs in a mark) and its line break last, so the lines' text is the
  // code as given. A line some step marks whole is a mark of its own around its pieces. Only the
  // pre keeps a template's whitespace, so the templates after it can be laid out.
  template: `
    <pre
      #box
      [attr.data-overflow]="overflow()"
      [attr.data-line-numbers]="lineNumbers() || null"
      [attr.data-dim]="dimmed() || null"
      [style.--line-number-digits]="digits()"
    ><code><ng-content>@for (line of focus().lines; track $index) {<span class="line" [attr.data-marked]="line.band || null">@if (line.band !== null) {<mark data-line [attr.data-on]="line.band || null" [attr.role]="line.band ? null : 'none'"><ng-container *ngTemplateOutlet="pieces; context: { $implicit: line.pieces }" /></mark>} @else {<ng-container *ngTemplateOutlet="pieces; context: { $implicit: line.pieces }" />}{{ line.end }}</span>}</ng-content></code></pre>
    @if (copy(); as what) {
      <neat-copy-button [text]="code()" [what]="what" />
    }
    @if (stepCount(); as count) {
      @if (stepControls()) {
        <div class="steps">
          <button
            neatButton
            type="button"
            variant="text"
            size="small"
            [attr.aria-disabled]="shownStep() === 0 || null"
            (click)="move(-1)"
          >
            <neat-icon name="previous" [size]="16" />
            Previous
          </button>
          <span class="position">{{ shownStep() + 1 }} of {{ count }}</span>
          <button
            neatButton
            type="button"
            variant="text"
            size="small"
            [attr.aria-disabled]="shownStep() === count - 1 || null"
            (click)="move(1)"
          >
            Next
            <neat-icon name="next" [size]="16" />
          </button>
        </div>
      }
      <span class="sr-only" aria-live="polite">{{ announcement() }}</span>
    }

    <!-- A mark that no step has shown at the moment is no mark to a screen reader (role none). -->
    <ng-template #pieces let-pieces>
      @for (piece of pieces; track $index) {
        @if (piece.mark; as mark) {
          <mark
            [attr.data-on]="mark.on || null"
            [attr.data-join]="mark.join"
            [attr.role]="mark.on ? null : 'none'"
            ><ng-container *ngTemplateOutlet="runs; context: { $implicit: piece.runs }"
          /></mark>
        } @else {
          <ng-container *ngTemplateOutlet="runs; context: { $implicit: piece.runs }" />
        }
      }
    </ng-template>
    <ng-template #runs let-runs>
      @for (run of runs; track $index) {
        <span [attr.data-kind]="run.kind">{{ run.text }}</span>
      }
    </ng-template>
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
  /**
   * The lines and parts of lines the block sets apart (a `NeatCodeMark` each), counted from 1.
   * Not used while the block has `steps`.
   */
  readonly marks = input<readonly NeatCodeMark[]>([]);
  /** Whether the code outside the marks dims while there are marks. On by default. */
  readonly dim = input(true, { transform: booleanAttribute });
  /**
   * A walk through the code, a `NeatCodeStep` at a time, each with its own marks. While there are
   * steps, the block is a tab stop whose arrow keys move between them.
   */
  readonly steps = input<readonly NeatCodeStep[]>([]);
  /** The step shown, from 0: bind it both ways to follow the block, or to move it. */
  readonly step = model(0);
  /** Whether Previous and Next buttons and the position ("2 of 5") show under the code. */
  readonly stepControls = input(false, { transform: booleanAttribute });

  /** The languages the block colors: its own, and those the app added (which win). */
  private readonly languages = inject(NEAT_CODE_LANGUAGES);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');

  private readonly highlighter = resource({
    params: () => this.language() ?? undefined,
    loader: ({ params: language }) => highlighterFor(language, this.languages),
  });

  /** The code's lines uncolored, and their text, which marks are placed on. */
  private readonly plain = computed(() => plainLines(this.code()));
  private readonly texts = computed(() =>
    this.plain().map((line) => line.runs.map((run) => run.text).join('')),
  );

  /** The lines shown: colored once the language's highlighter is there, plain until then. */
  private readonly lines = computed(() => {
    const highlighter = this.highlighter.hasValue() ? this.highlighter.value() : undefined;
    return highlighter ? highlighter.lines(this.code()) : this.plain();
  });

  protected readonly stepCount = computed(() => this.steps().length);
  /** The step shown: `step`, kept to the steps there are. */
  protected readonly shownStep = computed(() =>
    Math.max(0, Math.min(this.step(), this.stepCount() - 1)),
  );

  /** The lines with every step's marks on them (or `marks` alone), those of the shown step on. */
  protected readonly focus = computed(() => {
    const steps = this.steps();
    return steps.length
      ? focusLines(
          this.lines(),
          this.texts(),
          steps.map((step) => step.marks),
          this.shownStep(),
        )
      : focusLines(this.lines(), this.texts(), [this.marks()], 0);
  });
  protected readonly dimmed = computed(() => this.dim() && this.focus().marked);

  /** How many digits the last line's number has, which sets the gutter's width. */
  protected readonly digits = computed(() => String(this.lines().length).length);

  /** What the live region says of the shown step, which it says again on each change. */
  protected readonly announcement = computed(() => {
    const count = this.stepCount();
    if (!count) return '';
    const label = this.steps()[this.shownStep()].label;
    return `Step ${this.shownStep() + 1} of ${count}${label ? `: ${label}` : ''}`;
  });

  constructor() {
    // Brings the first mark shown into the box's view whenever the marks shown change.
    afterRenderEffect(() => {
      this.focus();
      const box = this.box().nativeElement;
      const first = box.querySelector('.line[data-marked], mark[data-on]:not([data-line])');
      if (first) scrollToShow(box, first, !reducedMotion());
    });
  }

  /** Moves `by` steps, if there is a step there; whether it moved. */
  protected move(by: number): boolean {
    const next = this.shownStep() + by;
    if (next < 0 || next >= this.stepCount()) return false;
    this.step.set(next);
    return true;
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.stepCount() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    // On the code while it scrolls sideways, the arrows scroll it.
    if (this.box().nativeElement.contains(event.target as Node)) return;
    const by = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (by && this.move(by)) event.preventDefault();
  }
}
