import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatIcon, ɵreducedMotion } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatMarkdown, type NeatTextMotion } from '@sima/neat-ui/markdown';
import { FollowScroll } from './follow-scroll';
import { NeatChatOrb } from './orb';
import type { NeatChatMessage, NeatChatState } from './types';

/** What a message's template is given: the message, as `$implicit`. */
interface MessageContext {
  readonly $implicit: NeatChatMessage;
}

/**
 * The app's line under a message, given the message: a reply's figures ("first word 0.22 s ·
 * 24.6 words/s"), how a spoken question was heard. One template for every message; match the
 * message inside it.
 *
 * ```html
 * <ng-template neatChatMessageFooter let-message>
 *   @if (figures(message.id); as f) { first word {{ f.firstWord }} s }
 * </ng-template>
 * ```
 */
@Directive({ selector: 'ng-template[neatChatMessageFooter]' })
export class NeatChatMessageFooter {
  /** @internal */
  readonly template = inject<TemplateRef<MessageContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: NeatChatMessageFooter,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is MessageContext {
    return true;
  }
}

/**
 * The app's buttons in a failed reply's callout, given the message: "New chat" when the
 * conversation outgrew the model, "Try again" for a lost connection.
 */
@Directive({ selector: 'ng-template[neatChatErrorActions]' })
export class NeatChatErrorActions {
  /** @internal */
  readonly template = inject<TemplateRef<MessageContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: NeatChatErrorActions,
    // Only its type is read: the guard tells the template compiler what `let-` variables hold.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    context: unknown,
  ): context is MessageContext {
    return true;
  }
}

/** How much of a finished reply the announcement reads. */
const ANNOUNCED_CHARACTERS = 200;

/**
 * A conversation with a model, drawn from the app's messages: the visitor's questions as bubbles
 * on the end side with their pictures, the model's replies as Markdown across the width.
 *
 * ```html
 * <neat-page scroll="none">
 *   <neat-chat-transcript [messages]="conversation.messages()" />
 *   <neat-message-box (send)="conversation.ask($event)" />
 * </neat-page>
 * ```
 *
 * **The messages are plain data the app owns** (`NeatChatMessage`). While a reply streams, the app
 * writes its whole text so far, once for each piece that arrives; the transcript shows what is new
 * and keeps what it already drew. A reply is `waiting` (an orb and clock, the seconds since it
 * began to wait, until its first word), `streaming` (its newest text in the `textMotion`), `done`,
 * `stopped` ("Stopped" after its text) or `error` (the message's `error` in a danger callout, with
 * the app's `neatChatErrorActions` buttons). `neatChatMessageFooter` adds the app's own line under
 * each message.
 *
 * **Its `textMotion`** is how a reply's newest text appears (`NeatTextMotion`, `plain` by
 * default), for every reply the transcript saw waiting or streaming; a reply it first sees
 * mid-stream (a page opened late) shows whole, and only its later pieces move. A motion changed
 * while a reply streams moves what comes after the change. Under reduced motion the text is plain
 * and the orb stands still while its clock counts.
 *
 * **It scrolls itself**, as the page's one scroll area (put it in `neat-page scroll="none"` with
 * its parent giving it the height): it follows a growing reply (and a picture that loads) while
 * the reader is at the end, stops as soon as they scroll up, and then shows Latest, which goes back
 * to the end and follows again. A question the visitor sends brings it back to the end too.
 *
 * **For assistive technology** it is a `log` named by `label` that is not live, so a reply is not
 * read token by token, and a tab stop, so it scrolls by keys; once a reply is done, a polite
 * announcement reads "Reply finished:" and its beginning, and "Reply failed:" and why when it
 * fails. Latest leaves the focus on the log.
 */
@Component({
  selector: 'neat-chat-transcript',
  imports: [NgTemplateOutlet, NeatButton, NeatCallout, NeatChatOrb, NeatIcon, NeatMarkdown],
  templateUrl: './transcript.html',
  styleUrl: './transcript.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NeatChatTranscript {
  /** The conversation, oldest first. */
  readonly messages = input.required<readonly NeatChatMessage[]>();
  /** The name of the conversation for assistive technology. */
  readonly label = input('Conversation');
  /**
   * How a streaming reply's newest text appears: `plain`, the default, or one of the kit's text
   * motions (`NEAT_TEXT_MOTIONS`), for the replies the transcript saw waiting or streaming.
   */
  readonly textMotion = input<NeatTextMotion>('plain');
  /** How many words float in the word cloud (`textMotion` `word-cloud`): 1 to 40, 12 by default. */
  readonly cloudWords = input(12);

  protected readonly footer = contentChild(NeatChatMessageFooter);
  protected readonly errorActions = contentChild(NeatChatErrorActions);
  /** True while the reader has scrolled up, away from the end: Latest shows. */
  protected readonly away = signal(false);
  protected readonly announcement = signal('');

  private readonly scrollBox = viewChild.required<ElementRef<HTMLElement>>('scroll');
  private follow: FollowScroll | null = null;
  private readonly seen = new Map<string, NeatChatState>();
  /** The replies seen waiting or streaming in a render: theirs is the text motion. */
  private readonly moving = new Set<string>();
  private rendered = false;

  constructor() {
    const zone = inject(NgZone);
    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        this.follow = new FollowScroll(
          this.scrollBox().nativeElement,
          (away) => zone.run(() => this.away.set(away)),
          ɵreducedMotion,
        );
        this.follow.contentChanged();
      });
    });
    inject(DestroyRef).onDestroy(() => this.follow?.destroy());
    afterRenderEffect({
      write: () => {
        const asked = this.noteChanges(this.messages());
        // A question the visitor just sent brings the transcript back to the end, to its reply.
        if (asked) this.follow?.resume();
        else this.follow?.contentChanged();
      },
    });
  }

  protected stateOf(message: NeatChatMessage): NeatChatState {
    return message.state ?? 'done';
  }

  /**
   * The text motion of a reply: the chosen one for a reply seen waiting or streaming in an earlier
   * render, else plain, so a reply first seen mid-stream shows whole and only later pieces move.
   */
  protected motionFor(message: NeatChatMessage): NeatTextMotion {
    return this.moving.has(message.id) ? this.textMotion() : 'plain';
  }

  /** Back to the end; the focus goes to the conversation, since the button it was on goes. */
  protected latest(): void {
    this.follow?.latest();
    this.scrollBox().nativeElement.focus({ preventScroll: true });
  }

  /**
   * Announces a reply that went from waiting or streaming to done or to a failure, once, and says
   * whether the visitor sent a question since the last render (not counting the first render, a
   * conversation the app restored).
   */
  private noteChanges(messages: readonly NeatChatMessage[]): boolean {
    const first = this.seen.size === 0 && !this.rendered;
    this.rendered = true;
    const present = new Set<string>();
    let asked = false;
    for (const message of messages) {
      present.add(message.id);
      const state = this.stateOf(message);
      const before = this.seen.get(message.id);
      this.seen.set(message.id, state);
      if (message.role === 'user') {
        asked ||= before === undefined && !first;
        continue;
      }
      if (state === 'waiting' || state === 'streaming') this.moving.add(message.id);
      const was = before === 'waiting' || before === 'streaming';
      if (was && state === 'done') {
        this.announcement.set(
          `Reply finished: ${plainText(message.text).slice(0, ANNOUNCED_CHARACTERS)}`,
        );
      } else if (was && state === 'error') {
        this.announcement.set(`Reply failed: ${message.error ?? ''}`.trim());
      }
    }
    for (const id of [...this.seen.keys()]) {
      if (present.has(id)) continue;
      this.seen.delete(id);
      this.moving.delete(id);
    }
    return asked;
  }
}

/** Markdown's text without its marks, for an announcement. */
function plainText(markdown: string): string {
  return markdown
    .replace(/```[^\n]*\n?/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
