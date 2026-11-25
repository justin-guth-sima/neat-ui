import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  NgZone,
  output,
} from '@angular/core';
import { ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
import { CHAT_CLOCK } from './chat-clock';
import type { NeatListeningMotion } from './push-to-talk';

/** The glyphs a letter still being decrypted shows: the moments mockup's. */
export const HEARD_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*';
/** Ring and waveform: how often two more letters show, and how many glyphs run ahead of them. */
const STEP_MS = 30;
const PER_STEP = 2;
const AHEAD = 10;
/** Radial and in the message box: each word's delay after the last, and its own time (CSS). */
const WORD_DELAY_MS = 70;
const WORD_MS = 350;
/** In the message box: how long the text flies from the box to its place (CSS). */
const FLIGHT_MS = 500;

/** The text as letters (graphemes), for the decrypt. */
function lettersOf(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(text);
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (s) => s.segment,
  );
}

/** The text as words, each a word-like segment with what follows it, for any language. */
function wordsOf(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return text.match(/\S+\s*/g) ?? [text];
  const words: string[] = [];
  for (const { segment, isWordLike } of new Intl.Segmenter(undefined, {
    granularity: 'word',
  }).segment(text)) {
    if (isWordLike || words.length === 0) words.push(segment);
    else words[words.length - 1] += segment;
  }
  return words;
}

/**
 * A heard question arriving in the transcript in the listening motion it was recorded in: its
 * letters decrypting out of glyphs (ring and waveform), its words coming into focus one by one
 * (radial), or its text flying out of the message box's text area into the bubble while its words
 * come into focus (in the message box). The text has its whole size from the first frame and every
 * letter stays in the accessibility tree. Internal to the transcript, which makes none under
 * reduced motion.
 */
@Component({
  selector: 'neat-chat-heard',
  templateUrl: './heard.html',
  styleUrl: './heard.css',
  host: { '[attr.data-motion]': 'motion()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeardArrival {
  /** What speech-to-text heard. */
  readonly text = input.required<string>();
  /** How it arrives. */
  readonly motion = input.required<Exclude<NeatListeningMotion, 'level'>>();
  /** Where it flies from (`in-message-box`): the box's text area, or null for none. */
  readonly origin = input<HTMLElement | null>(null);
  /** The arrival is over: the plain text shows. */
  readonly done = output<void>();

  protected readonly letters = computed(() => lettersOf(this.text()));
  protected readonly words = computed(() => wordsOf(this.text()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const clock = inject(CHAT_CLOCK);
    const document = inject(DOCUMENT);
    const zone = inject(NgZone);
    let engine: HeardEngine | null = null;
    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        engine = new HeardEngine(
          host,
          this.motion(),
          this.words().length,
          this.origin(),
          { clock, document },
          () => zone.run(() => this.done.emit()),
        );
      });
    });
    inject(DestroyRef).onDestroy(() => engine?.destroy());
  }
}

/**
 * The arrival's frames: the decrypt's letters and glyphs, the flight's start, and the end. It
 * writes only attributes and the host's inline transform. Internal.
 */
class HeardEngine {
  private readonly startedAt: number;
  private readonly endsAt: number;
  private readonly letters: HTMLElement[];
  private shown = 0;
  private step = -1;
  private flown = false;
  private readonly frames: ɵFrameLoop;

  constructor(
    private readonly host: HTMLElement,
    private readonly motion: Exclude<NeatListeningMotion, 'level'>,
    words: number,
    private readonly origin: HTMLElement | null,
    deps: { readonly clock: ɵFrameClock; readonly document: Document },
    private readonly onDone: () => void,
  ) {
    this.startedAt = deps.clock.now();
    this.letters = [...host.querySelectorAll<HTMLElement>('span.c')];
    const wordsEnd = Math.max(0, words - 1) * WORD_DELAY_MS + WORD_MS;
    this.endsAt =
      motion === 'ring-and-waveform'
        ? Number.POSITIVE_INFINITY
        : this.startedAt +
          Math.max(wordsEnd, motion === 'in-message-box' && origin ? FLIGHT_MS : 0);
    this.frames = new ɵFrameLoop(
      { ...deps, stopped: () => this.onDone() },
      () => this.frame(deps.clock.now()),
      () => this.moving(deps.clock.now()),
    );
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
  }

  private moving(now: number): boolean {
    if (this.motion === 'ring-and-waveform') return this.shown < this.letters.length;
    return now < this.endsAt;
  }

  private frame(now: number): void {
    if (this.motion === 'ring-and-waveform') this.decrypt(now);
    else if (this.motion === 'in-message-box' && !this.flown) this.fly();
  }

  /** Two more letters every 30 ms, the next ten as glyphs, renewed each step. */
  private decrypt(now: number): void {
    const step = Math.floor((now - this.startedAt) / STEP_MS);
    if (step === this.step) return;
    this.step = step;
    const shown = Math.min(this.letters.length, step * PER_STEP);
    for (let i = this.shown; i < shown; i++) {
      this.letters[i].setAttribute('data-shown', '');
      this.letters[i].removeAttribute('data-glyph');
    }
    this.shown = shown;
    const end = Math.min(this.letters.length, shown + AHEAD);
    for (let i = shown; i < end; i++) {
      const letter = this.letters[i];
      if (/\s/.test(letter.textContent ?? '')) continue;
      letter.setAttribute(
        'data-glyph',
        HEARD_GLYPHS[Math.floor(Math.random() * HEARD_GLYPHS.length)],
      );
    }
  }

  /** The flight: drawn at the origin, then let go to its place, which the CSS transition flies to. */
  private fly(): void {
    this.flown = true;
    if (!this.origin) return;
    const from = this.origin.getBoundingClientRect();
    const to = this.host.getBoundingClientRect();
    this.host.setAttribute('data-start', '');
    this.host.setAttribute('data-flying', '');
    this.host.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
    // Reading the layout draws the start before the transition takes it away.
    this.host.getBoundingClientRect();
    this.host.removeAttribute('data-start');
    this.host.style.transform = '';
  }
}
