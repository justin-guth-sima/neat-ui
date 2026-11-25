import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type Signal,
} from '@angular/core';
import { NeatProse, ɵreducedMotion } from '@sima/neat-ui';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';
import { NeatTable } from '@sima/neat-ui/table';
import type { Token } from 'marked';
import { type MarkdownBlock, MarkdownBlocks } from './blocks';
import { TextArrivals } from './motion/arrivals';
import { ArrivalDelay } from './motion/arrival-delay';
import { runMotionEngine } from './motion/engine';
import { MOTION_CLOCK } from './motion/motion-clock';
import type { ShownPiece } from './motion/shown';
import { type NeatTextMotion, TEXT_MOTIONS } from './motion/text-motions';

/** What the template draws: the blocks, and the pieces of the prose runs that move. */
interface Shown {
  readonly blocks: readonly MarkdownBlock[];
  readonly pieces: ReadonlyMap<Token, readonly ShownPiece[]>;
  /** Changes when the pieces start again, for the motion's engine. */
  readonly epoch: number;
}

const NO_PIECES: ReadonlyMap<Token, readonly ShownPiece[]> = new Map();

/** How many pieces can fly into place at once in the word cloud. */
const CLOUD_FLIGHTS = 24;

/** A cloud's word count: a whole number from 1 to 40. */
function cloudWordCount(value: number): number {
  return Math.min(40, Math.max(1, Math.round(value)));
}

/**
 * Markdown, as a model writes its replies, drawn in the kit's prose: headings, paragraphs, lists
 * (task items with ☐ and ☑), quotes, rules, tables in the kit's table look and fenced code as the
 * kit's code block, colored by its language.
 *
 * ```html
 * <neat-markdown [text]="reply.text" [streaming]="reply.state === 'streaming'" />
 * ```
 *
 * It draws the Markdown with its own templates, never as HTML: raw HTML in the text shows as text,
 * an image as its alt text in brackets, and a link is a link only to an `http:` or `https:`
 * address (opened in a new tab), else its text. So text from a model can be shown as it comes.
 *
 * **While `streaming`,** the text may grow with every update. Finished blocks keep their elements,
 * and only the last two blocks are read again, so the cost of an update grows with them, not
 * with the text.
 * Marks the model has opened but not yet closed are closed ahead: `**bold` is bold at once and an
 * open code fence is already a code block, so nothing reflows when the closing mark arrives. Some
 * Markdown only resolves later (a table's header row before its separator line): it shows as what
 * it is so far, a paragraph, and changes once.
 *
 * While streaming, a caret (a bar in `--primary`, blinking unless reduced motion is on) ends the
 * last paragraph, heading or list item; a code block or a table that is still growing shows
 * that it grows by itself.
 *
 * **Its `motion`** is how the newest text appears while it streams (`NeatTextMotion`): `plain` by
 * default, or one of the kit's text motions. Each write's new characters in the prose are a piece
 * that moves for a moment and then settles into plain text; code blocks, tables and inline code
 * grow plainly. A text that is no continuation of the one before shows whole and plain at once,
 * and a motion changed while the text streams moves only what comes after the change. Under
 * reduced motion every motion shows plain.
 *
 * The host is prose (`NeatProse`) and a block; the app sets its width.
 */
@Component({
  selector: 'neat-markdown',
  imports: [NgTemplateOutlet, NeatCodeBlock, NeatTable, ArrivalDelay],
  hostDirectives: [NeatProse],
  host: {
    '[attr.data-streaming]': "streaming() ? '' : null",
    '[attr.data-motion]': "motion() === 'plain' ? null : motion()",
    '[style.--neat-motion-ms]': 'rules().settleMs + "ms"',
  },
  templateUrl: './markdown.html',
  styleUrl: './markdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeatMarkdown {
  /** The Markdown to show. */
  readonly text = input.required<string>();
  /** True while the text still grows: unclosed marks are closed ahead (see the class). */
  readonly streaming = input(false, { transform: booleanAttribute });
  /**
   * How many levels a heading moves down: with 2, the default, `#` is an `h3`, since a page's own
   * title and sections take `h1` and `h2`. Headings stop at `h6`.
   */
  readonly headingOffset = input(2);

  /**
   * How the newest text appears while it streams: `plain`, the default, or one of the kit's text
   * motions (`NEAT_TEXT_MOTIONS`). Under reduced motion every motion shows plain.
   */
  readonly motion = input<NeatTextMotion>('plain');

  /**
   * How many words float in the word cloud (the `word-cloud` motion): a whole number from 1 to
   * 40, 12 by default.
   */
  readonly cloudWords = input(12, { transform: cloudWordCount });

  private readonly clock = inject(MOTION_CLOCK);
  private readonly lexed = new MarkdownBlocks();
  private readonly arrivals = new TextArrivals();
  private shownMotion: NeatTextMotion = 'plain';

  protected readonly rules = computed(() => TEXT_MOTIONS[this.motion()]);

  /**
   * The blocks and the pieces that move. Arrivals are recorded only while the text streams in a
   * motion other than plain and reduced motion is off; they start again when the motion changes
   * and when the text is no continuation. Once the text stops streaming, the last pieces move to
   * their end and record nothing new.
   */
  protected readonly shown = computed((): Shown => {
    const motion = this.motion();
    const streaming = this.streaming();
    const blocks = this.lexed.update(this.text(), streaming);
    const grown = this.lexed.grown;
    if (motion !== this.shownMotion || grown === null) {
      // A new motion, or a text written anew: nothing shown before moves.
      this.arrivals.reset();
      this.shownMotion = motion;
    }
    if (motion === 'plain' || ɵreducedMotion()) {
      this.arrivals.reset();
      return { blocks, pieces: NO_PIECES, epoch: this.arrivals.epoch };
    }
    const { settleMs, group } = TEXT_MOTIONS[motion];
    const pieces = this.arrivals.update(
      blocks,
      streaming ? (grown ?? 0) : 0,
      this.clock.now(),
      settleMs,
      group,
    );
    return { blocks, pieces, epoch: this.arrivals.epoch };
  });

  /** The motion that moves: none under reduced motion. */
  protected readonly moving = computed(() => (ɵreducedMotion() ? null : this.motion()));

  /** Whether the motion's engine runs: while the text streams, and until its last motion ends. */
  private readonly engineRuns: Signal<boolean>;

  /**
   * The motion whose layer (the particles' canvas, the cloud) the template renders: while the text
   * streams, so the engine finds it, and while the engine still runs. A finished reply has none.
   */
  protected readonly layer = computed(() =>
    this.streaming() || this.engineRuns() ? this.moving() : null,
  );

  /** The word cloud's words, one slot each, and the pool of its flights. */
  protected readonly cloudSlots = computed(() => Array.from({ length: this.cloudWords() }));
  protected readonly flightSlots = Array.from({ length: CLOUD_FLIGHTS });

  /** Whether the last prose block ends in the decrypt motion's tail. */
  protected readonly tail = computed(() => this.moving() === 'decrypt' && this.streaming());

  constructor() {
    this.engineRuns = runMotionEngine(this.motion, this.streaming, this.shown, this.cloudWords);
  }

  /** The pieces a prose run renders, or null to render its text whole. */
  protected piecesFor(token: Token): readonly ShownPiece[] | null {
    return this.shown().pieces.get(token) ?? null;
  }

  protected headingLevel(depth: number): number {
    return Math.min(6, Math.max(1, depth + this.headingOffset()));
  }

  /** The address a link may open: an absolute `http:` or `https:` URL, else null. */
  protected safeHref(href: string): string | null {
    try {
      const url = new URL(href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  /** A fence's language: the first word of its info string, or null without one. */
  protected languageOf(lang: string | undefined): string | null {
    const name = lang?.trim().split(/\s+/)[0];
    return name ? name : null;
  }

  /** An ordered list's start, where it is not 1. */
  protected startOf(start: number | ''): number | null {
    return typeof start === 'number' && start !== 1 ? start : null;
  }
}
