import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  NgZone,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { NeatButton, NeatExpand, NeatIcon, NeatTooltip, ɵreducedMotion } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatMarkdown, type NeatSpeakingMotion, type NeatTextMotion } from '@sima/neat-ui/markdown';
import { FollowScroll } from './follow-scroll';
import { NeatChatOrb } from './orb';
import { HeardArrival } from './heard';
import { SpeechStripView } from './speech-strip';
import { type NeatPictureMotion, PictureReading } from './picture-reading';
import type { NeatListeningMotion } from './push-to-talk';
import { HeardOrigin } from './voice/heard-origin';
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

/** A question's pictures being read while its reply waits. */
interface Reading {
  /** Tells this reading from an earlier one of the same question, whose overlay it replaces. */
  readonly id: number;
  readonly motion: Exclude<NeatPictureMotion, 'none'>;
  /** The reply's first word came, or the reply went. */
  readonly answered: boolean;
  /** The reply the question waits for. */
  readonly replyId: string;
  /** The reply's orb, where the patches fly. */
  readonly target: () => HTMLElement | null;
  /** The pictures still being read; a picture's reading leaves once it is done. */
  readonly pictures: ReadonlySet<string>;
}

/** A heard question arriving in its listening motion. */
interface Arrival {
  readonly motion: NeatListeningMotion;
  /** Where it flies from: the message box's text area, for `in-message-box`. */
  readonly origin: HTMLElement | null;
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
 * while a reply streams moves what comes after the change. **Its `pictureMotion`** shows the
 * model reading a question's pictures while the reply waits (`NeatPictureMotion`, coming into
 * focus by default), finishing soon after the first word. Under reduced motion the text and the
 * pictures are plain, and the orb stands still while its clock counts. **Its `listeningMotion`**
 * is how a heard question (`heard`, spoken by the visitor) arrives when it joins the conversation:
 * its letters decrypt out of glyphs (`ring-and-waveform`), its words come into focus one by one
 * (`radial`), or its text flies out of the message box's text area while its words come into
 * focus (`in-message-box`, the default); reduced motion shows it plain, as is a heard question
 * restored with the conversation. The bubble has its whole size from the start, and the
 * text is plain again once it has arrived.
 *
 * **Read aloud:** a reply's `speech` (`NeatSpeech`, from the app's read aloud) is the sentence
 * being said; the reply shows it in the `speakingMotion` (`NeatSpeakingMotion`), the text after it
 * muted, and with `waveform` a strip of the sentence's audio grows in under the reply, its
 * playhead where the voice is, and shrinks away when the speech goes.
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
  imports: [
    NgTemplateOutlet,
    NeatButton,
    NeatCallout,
    NeatChatOrb,
    NeatExpand,
    NeatIcon,
    NeatTooltip,
    NeatMarkdown,
    PictureReading,
    HeardArrival,
    SpeechStripView,
  ],
  host: { '[style.--neat-picture-scale]': 'pictureScale()' },
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
  /**
   * How a question's pictures show that the model reads them while its reply waits
   * (`NeatPictureMotion`): `coming-into-focus`, the default, another of `NEAT_PICTURE_MOTIONS`, or
   * `none`. A reading begins when the transcript first sees the reply waiting and ends soon after
   * its first word; a motion changed meanwhile applies to the next.
   */
  readonly pictureMotion = input<NeatPictureMotion>('coming-into-focus');
  /**
   * How large a message's pictures show: each keeps its proportions within a 20 × 14 rem box times
   * this, 1 by default, and never wider than the conversation. Each also has an Expand button that
   * shows it over the whole window (`NeatExpand`), Close or Escape putting it back.
   */
  readonly pictureScale = input(1);
  /**
   * How a heard question arrives when it joins the conversation (`NeatListeningMotion`), matching
   * push-to-talk's motion of the same name: `in-message-box`, the default, flies out of the box's
   * text area. Under reduced motion it shows plain.
   */
  readonly listeningMotion = input<NeatListeningMotion>('in-message-box');
  /**
   * How a reply being read aloud (its `speech`) shows how far the voice got
   * (`NeatSpeakingMotion`): `sentence`, the default and the still form, `karaoke`,
   * `word-by-word`, or `waveform`, which adds a strip of the sentence's audio under the reply.
   * Under reduced motion every motion is `sentence`.
   */
  readonly speakingMotion = input<NeatSpeakingMotion>('sentence');

  protected readonly footer = contentChild(NeatChatMessageFooter);
  protected readonly errorActions = contentChild(NeatChatErrorActions);
  /** True while the reader has scrolled up, away from the end: Latest shows. */
  protected readonly away = signal(false);
  protected readonly announcement = signal('');
  /** The questions whose pictures are being read, by question id. */
  protected readonly readings = signal<ReadonlyMap<string, Reading>>(new Map());
  /** The heard questions arriving, by question id. */
  protected readonly arrivals = signal<ReadonlyMap<string, Arrival>>(new Map());
  private readonly origin = inject(HeardOrigin);
  /** Whether a reply being read aloud shows the waveform's strip. */
  protected readonly strips = computed(
    () => this.speakingMotion() === 'waveform' && !ɵreducedMotion(),
  );

  private readonly scrollBox = viewChild.required<ElementRef<HTMLElement>>('scroll');
  private follow: FollowScroll | null = null;
  private readonly seen = new Map<string, NeatChatState>();
  /** The replies seen waiting or streaming in a render: theirs is the text motion. */
  private readonly moving = new Set<string>();
  private rendered = false;
  private readingCount = 0;

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

  /**
   * The reading over a picture, as a list of none or one, so a new reading of the same question
   * (its reply asked again) makes a new overlay instead of changing the motion of the old one.
   */
  protected readingOf(questionId: string, pictureId: string): readonly Reading[] {
    const reading = this.readings().get(questionId);
    return reading?.pictures.has(pictureId) ? [reading] : [];
  }

  /** A heard question has arrived: its plain text shows. */
  protected finishArrival(questionId: string): void {
    if (!this.arrivals().has(questionId)) return;
    const next = new Map(this.arrivals());
    next.delete(questionId);
    this.arrivals.set(next);
  }

  /** A picture's reading is done: the plain picture shows. */
  protected finishReading(questionId: string, pictureId: string): void {
    const reading = this.readings().get(questionId);
    if (!reading?.pictures.has(pictureId)) return;
    const next = new Map(this.readings());
    const pictures = new Set(reading.pictures);
    pictures.delete(pictureId);
    if (pictures.size > 0) next.set(questionId, { ...reading, pictures });
    else next.delete(questionId);
    this.readings.set(next);
  }

  /** Back to the end; the focus goes to the conversation, since the button it was on goes. */
  protected latest(): void {
    this.follow?.latest();
    this.scrollBox().nativeElement.focus({ preventScroll: true });
  }

  /**
   * Announces a reply that went from waiting or streaming to done or to a failure, once, starts and
   * ends the readings of the questions' pictures, and says whether the visitor sent a question
   * since the last render (not counting the first render, a conversation the app restored).
   */
  private noteChanges(messages: readonly NeatChatMessage[]): boolean {
    const first = this.seen.size === 0 && !this.rendered;
    this.rendered = true;
    const present = new Set<string>();
    const readings = new Map(untracked(this.readings));
    let readingsChanged = false;
    const arrivals = new Map(untracked(this.arrivals));
    let arrivalsChanged = false;
    let asked = false;
    messages.forEach((message, index) => {
      present.add(message.id);
      const state = this.stateOf(message);
      const before = this.seen.get(message.id);
      this.seen.set(message.id, state);
      if (message.role === 'user') {
        const fresh = before === undefined && !first;
        asked ||= fresh;
        const arrival = fresh && message.heard ? this.startArrival() : null;
        if (arrival) {
          arrivals.set(message.id, arrival);
          arrivalsChanged = true;
        }
        return;
      }
      if (state === 'waiting' || state === 'streaming') this.moving.add(message.id);
      const question = messages[index - 1];
      if (before === undefined && state === 'waiting' && question?.role === 'user') {
        const reading = this.startReading(question, message.id);
        if (reading) {
          readings.set(question.id, reading);
          readingsChanged = true;
        }
      }
      const reading = question && readings.get(question.id);
      if (reading && !reading.answered && state !== 'waiting') {
        readings.set(question.id, { ...reading, answered: true });
        readingsChanged = true;
      }
      const was = before === 'waiting' || before === 'streaming';
      if (was && state === 'done') {
        this.announcement.set(
          `Reply finished: ${plainText(message.text).slice(0, ANNOUNCED_CHARACTERS)}`,
        );
      } else if (was && state === 'error') {
        this.announcement.set(`Reply failed: ${message.error ?? ''}`.trim());
      }
    });
    for (const id of [...this.seen.keys()]) {
      if (present.has(id)) continue;
      this.seen.delete(id);
      this.moving.delete(id);
    }
    for (const [id, reading] of readings) {
      if (!present.has(id)) {
        readings.delete(id);
        readingsChanged = true;
      } else if (!reading.answered && !present.has(reading.replyId)) {
        // Its reply went before its first word: the reading ends as if answered.
        readings.set(id, { ...reading, answered: true });
        readingsChanged = true;
      }
    }
    for (const id of arrivals.keys()) {
      if (present.has(id)) continue;
      arrivals.delete(id);
      arrivalsChanged = true;
    }
    if (readingsChanged) this.readings.set(readings);
    if (arrivalsChanged) this.arrivals.set(arrivals);
    return asked;
  }

  /** The arrival of a heard question in the listening motion, or null under reduced motion. */
  private startArrival(): Arrival | null {
    const motion = untracked(this.listeningMotion);
    if (ɵreducedMotion()) return null;
    return { motion, origin: motion === 'in-message-box' ? this.origin.take() : null };
  }

  /**
   * The reading of a question's pictures while reply `replyId` waits, or null for a question
   * without pictures, with `pictureMotion` `none` or under reduced motion.
   */
  private startReading(question: NeatChatMessage, replyId: string): Reading | null {
    const motion = untracked(this.pictureMotion);
    if (!question.pictures?.length || motion === 'none' || ɵreducedMotion()) return null;
    const scroll = this.scrollBox().nativeElement;
    return {
      id: ++this.readingCount,
      motion,
      answered: false,
      replyId,
      target: () => {
        for (const element of scroll.querySelectorAll<HTMLElement>('[data-message]')) {
          if (element.dataset['message'] === replyId) return element.querySelector('.orb');
        }
        return null;
      },
      pictures: new Set(question.pictures.map((picture) => picture.id)),
    };
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
