import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  NgZone,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatIcon, ɵreducedMotion as reducedMotion } from '@sima/neat-ui';
import { NeatBubble } from '@sima/neat-ui/bubble';
import { NeatCopyButton } from './copy-button';
import { highlighterFor } from './highlighter';
import { NEAT_CODE_LANGUAGES } from './languages';
import { plainLines } from './lines';
import { focusLines, type NeatCodeMark, type NeatCodeStep } from './marks';
import { watchNearView } from './near-view';
import { NeatCodeNote } from './note';
import { scrollToShow } from './scroll';
import { nextTurn } from './turns';

/**
 * How long a mark's note outlives the pointer leaving the mark, so the pointer can cross to the
 * bubble; another mark's note opens at once.
 */
const NOTE_CLOSE_DELAY = 150;

/** The same elements in the same order. */
const sameElements = (a: readonly Element[] | null, b: readonly Element[]) =>
  a !== null && a.length === b.length && a.every((element, i) => element === b[i]);

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
 * never loads C++. A block colors its code once it comes near the view, and one block at a time,
 * each in a task of its own, so a page of many blocks does not freeze while they all color. Until
 * then, and while the grammar loads, the block shows the code plain, in the same layout. A
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
 * A `NeatCodeNote` template inside the block shows a note in a bubble beside the marks: the shown
 * step's, or a mark's while it is hovered, focused or tapped, in the app's own words:
 *
 * ```html
 * <neat-code-block [code]="source" language="python" [steps]="walk" [(step)]="at" stepControls>
 *   <ng-template [neatCodeNote]="walk" let-step>{{ step.note }}</ng-template>
 * </neat-code-block>
 * ```
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
  imports: [NeatBubble, NeatButton, NeatCopyButton, NeatIcon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.tabindex]': 'stepCount() ? 0 : null',
    '[attr.role]': 'stepCount() ? "group" : null',
    '[attr.aria-label]': 'stepCount() ? "Code in steps" : null',
    '(keydown)': 'onKeydown($event)',
    // A mark's note: the handlers look only at marks inside the code.
    '(pointerover)': 'pointerOver($event)',
    '(pointerleave)': 'pointerLeave($event)',
    '(focusin)': 'focusIn($event)',
    '(focusout)': 'focusOut($event)',
    '(click)': 'tap($event)',
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
    ><code><ng-content>@for (line of focus().lines; track $index) {<span class="line" [attr.data-marked]="line.band || null">@if (line.band !== null) {<mark data-line [attr.data-on]="line.band || null" [attr.role]="line.band ? null : 'none'" [attr.data-mark]="hoverNotes() ? line.bandIndex : null" [attr.tabindex]="hoverNotes() && line.bandFirst ? 0 : null" [attr.aria-describedby]="describedBy(line.bandIndex)"><ng-container *ngTemplateOutlet="pieces; context: { $implicit: line.pieces }" /></mark>} @else {<ng-container *ngTemplateOutlet="pieces; context: { $implicit: line.pieces }" />}{{ line.end }}</span>}</ng-content></code></pre>
    <ng-content select="[neatCodeNote]" />
    @if (note(); as note) {
      <neat-bubble
        [anchor]="noteContext() ? noteAnchor() : null"
        [side]="note.neatCodeNoteSide()"
        (hover)="bubbleHover($event)"
      >
        @if (noteContext(); as context) {
          <ng-container *ngTemplateOutlet="note.template; context: context" />
        }
      </neat-bubble>
    }
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
            [attr.data-mark]="hoverNotes() ? mark.index : null"
            [attr.tabindex]="hoverNotes() && mark.first ? 0 : null"
            [attr.aria-describedby]="describedBy(mark.index)"
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

  /** The note template, which shows the step's or the mark's note in a bubble. */
  protected readonly note = contentChild(NeatCodeNote);

  /** The languages the block colors: its own, and those the app added (which win). */
  private readonly languages = inject(NEAT_CODE_LANGUAGES);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  private readonly bubble = viewChild(NeatBubble);
  private readonly document = inject(DOCUMENT);

  private readonly highlighter = resource({
    params: () => this.language() ?? undefined,
    loader: ({ params: language }) => highlighterFor(language, this.languages),
  });

  /** The code's lines uncolored, and their text, which marks are placed on. */
  private readonly plain = computed(() => plainLines(this.code()));
  private readonly texts = computed(() =>
    this.plain().map((line) => line.runs.map((run) => run.text).join('')),
  );

  /** Whether the block has come near the view, from which on it colors its code. */
  private readonly near = signal(false);

  /**
   * The code's lines colored, once the block is near the view and the language's highlighter is
   * there, tokenized in a turn of its own (`nextTurn`). New code is colored in a new turn, and a
   * turn whose code changed while it waited tokenizes nothing.
   */
  private readonly colored = resource({
    params: () => {
      const highlighter = this.highlighter.hasValue() ? this.highlighter.value() : undefined;
      return highlighter && this.near() ? { highlighter, code: this.code() } : undefined;
    },
    loader: async ({ params: { highlighter, code }, abortSignal }) => {
      await nextTurn();
      abortSignal.throwIfAborted();
      return highlighter.lines(code);
    },
  });

  /** The lines shown: colored once they are, plain until then. */
  private readonly lines = computed(() =>
    this.colored.hasValue() ? this.colored.value() : this.plain(),
  );

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

  /** Whether each mark shows its note on hover, focus or a tap: marks, no steps, and a note. */
  protected readonly hoverNotes = computed(
    () => this.note() !== undefined && !this.stepCount() && this.focus().marked,
  );
  /** The mark whose note shows, by its index in `marks`. */
  private readonly openMark = signal<number | null>(null);
  /** A mark whose note Escape put away, which the pointer or the focus must leave to show it again. */
  private dismissed: number | null = null;
  /** Whether a mouse or a pen is over the open mark, or over the bubble. */
  private pointerOnMark = false;
  private pointerOnBubble = false;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;

  /** What the note template is given, null while no note shows. */
  protected readonly noteContext = computed(() => {
    if (!this.note()) return null;
    if (this.stepCount()) {
      const index = this.shownStep();
      return { $implicit: this.steps()[index], index };
    }
    const index = this.openMark();
    const mark = index === null ? undefined : this.marks()[index];
    return this.hoverNotes() && index !== null && mark ? { $implicit: mark, index } : null;
  });
  /** The elements the note's bubble points at, found once they are rendered. */
  protected readonly noteAnchor = signal<readonly Element[] | null>(null);

  /** What the live region says of the shown step, which it says again on each change. */
  protected readonly announcement = computed(() => {
    const count = this.stepCount();
    if (!count) return '';
    const label = this.steps()[this.shownStep()].label;
    return `Step ${this.shownStep() + 1} of ${count}${label ? `: ${label}` : ''}`;
  });

  constructor() {
    const stopWatching = inject(NgZone).runOutsideAngular(() =>
      watchNearView(this.document.defaultView, inject(ElementRef).nativeElement, () =>
        this.near.set(true),
      ),
    );
    inject(DestroyRef).onDestroy(stopWatching);
    // Brings the first mark shown into the box's view whenever the marks shown change.
    afterRenderEffect(() => {
      this.focus();
      const box = this.box().nativeElement;
      const first = box.querySelector('.line[data-marked], mark[data-on]:not([data-line])');
      if (first) scrollToShow(box, first, !reducedMotion());
    });
    // The note's anchor: the shown step's marks (the whole code without any), or the open mark's
    // elements, a marked line by its whole line. Set only when it changes.
    afterRenderEffect(() => {
      const context = this.noteContext();
      this.focus();
      if (!context) return;
      const box = this.box().nativeElement;
      const elements = this.stepCount()
        ? [...box.querySelectorAll('.line[data-marked], mark[data-on]:not([data-line])')]
        : [...box.querySelectorAll(`[data-mark="${context.index}"]`)].map((element) =>
            element.hasAttribute('data-line') ? (element.closest('.line') ?? element) : element,
          );
      const anchor = elements.length ? elements : [box];
      if (!sameElements(this.noteAnchor(), anchor)) this.noteAnchor.set(anchor);
    });
    // While a mark's note shows, Escape and a press outside the marks and the bubble put it away.
    effect((onCleanup) => {
      if (this.openMark() === null) return;
      const press = (event: PointerEvent) => {
        const target = event.target as Node;
        const bubble = this.bubbleElement();
        if (this.markOf(target) === null && !bubble?.contains(target)) this.closeNote();
      };
      const key = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        this.dismissed = this.openMark();
        this.closeNote();
      };
      this.document.addEventListener('pointerdown', press, true);
      this.document.addEventListener('keydown', key);
      onCleanup(() => {
        this.document.removeEventListener('pointerdown', press, true);
        this.document.removeEventListener('keydown', key);
      });
    });
  }

  /** The bubble's id on the mark whose note shows, for `aria-describedby`. */
  protected describedBy(index: number | null): string | null {
    return index !== null && this.hoverNotes() && this.openMark() === index
      ? (this.bubble()?.id ?? null)
      : null;
  }

  /** The mark (its index in `marks`) of a node inside the code, null for none. */
  private markOf(node: EventTarget | null): number | null {
    if (!(node instanceof Element) || !this.box().nativeElement.contains(node)) return null;
    const mark = node.closest('[data-mark]');
    return mark ? Number(mark.getAttribute('data-mark')) : null;
  }

  private bubbleElement(): HTMLElement | null {
    const id = this.bubble()?.id;
    return id ? this.document.getElementById(id) : null;
  }

  protected pointerOver(event: PointerEvent): void {
    if (!this.hoverNotes() || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) {
      return;
    }
    const mark = this.markOf(event.target);
    if (mark !== this.dismissed) this.dismissed = null;
    this.pointerOnMark = mark !== null;
    if (mark === null) this.closeSoon();
    else if (mark !== this.dismissed) this.openNote(mark);
  }

  protected pointerLeave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    this.pointerOnMark = false;
    this.dismissed = null;
    this.closeSoon();
  }

  protected focusIn(event: FocusEvent): void {
    const mark = this.markOf(event.target);
    if (mark !== null && this.hoverNotes()) {
      this.dismissed = null;
      this.openNote(mark);
    }
  }

  protected focusOut(event: FocusEvent): void {
    if (this.markOf(event.relatedTarget) === null) this.closeSoon();
  }

  /** A tap on a mark (or a click) shows its note. */
  protected tap(event: MouseEvent): void {
    const mark = this.markOf(event.target);
    if (mark !== null && this.hoverNotes()) {
      this.dismissed = null;
      this.openNote(mark);
    }
  }

  protected bubbleHover(over: boolean): void {
    this.pointerOnBubble = over;
    if (over) clearTimeout(this.closeTimer);
    else this.closeSoon();
  }

  private openNote(mark: number): void {
    clearTimeout(this.closeTimer);
    this.openMark.set(mark);
  }

  /** Puts the note away after the delay, unless the pointer or the keyboard's focus holds it. */
  private closeSoon(): void {
    clearTimeout(this.closeTimer);
    if (this.openMark() === null) return;
    this.closeTimer = setTimeout(() => {
      const focused = this.markOf(this.document.activeElement);
      const held =
        this.pointerOnMark ||
        this.pointerOnBubble ||
        (focused !== null && focused === this.openMark());
      if (!held) this.closeNote();
    }, NOTE_CLOSE_DELAY);
  }

  private closeNote(): void {
    clearTimeout(this.closeTimer);
    this.pointerOnBubble = false;
    this.openMark.set(null);
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
