import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { NeatProse } from '@sima/neat-ui';
import { NeatCodeBlock } from '@sima/neat-ui/code-block';
import { NeatTable } from '@sima/neat-ui/table';
import { MarkdownBlocks } from './blocks';

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
 * and only the last block is read again, so the cost of an update does not grow with the text.
 * Marks the model has opened but not yet closed are closed ahead: `**bold` is bold at once and an
 * open code fence is already a code block, so nothing reflows when the closing mark arrives. Some
 * Markdown only resolves later (a table's header row before its separator line): it shows as what
 * it is so far, a paragraph, and changes once.
 *
 * While streaming, a caret (a bar in `--primary`, blinking unless reduced motion is on) ends the
 * last paragraph, heading or list item; a code block or a table that is still growing shows
 * that it grows by itself.
 *
 * The host is prose (`NeatProse`) and a block; the app sets its width.
 */
@Component({
  selector: 'neat-markdown',
  imports: [NgTemplateOutlet, NeatCodeBlock, NeatTable],
  hostDirectives: [NeatProse],
  host: { '[attr.data-streaming]': "streaming() ? '' : null" },
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

  private readonly lexed = new MarkdownBlocks();
  protected readonly blocks = computed(() => this.lexed.update(this.text(), this.streaming()));

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
