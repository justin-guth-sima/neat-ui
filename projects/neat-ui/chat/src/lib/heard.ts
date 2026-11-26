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

/** Each word's delay after the last, and its own time (CSS). */
const WORD_DELAY_MS = 70;
const WORD_MS = 350;
/** In the message box: how long the text flies from the box to its place (CSS). */
const FLIGHT_MS = 500;

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
 * A heard question arriving in the transcript in the listening motion it was recorded in: its words
 * coming into focus one by one (radial), or its text flying out of the message box's text area
 * into the bubble while its words come into focus (in the message box). The text has its whole
 * size from the first frame and every word stays in the accessibility tree. Internal to the transcript, which makes none under
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
  readonly motion = input.required<NeatListeningMotion>();
  /** Where it flies from (`in-message-box`): the box's text area, or null for none. */
  readonly origin = input<HTMLElement | null>(null);
  /** The arrival is over: the plain text shows. */
  readonly done = output<void>();

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
 * The arrival's frames: the flight's start, and the end once the words have come into focus. It
 * writes only attributes and the host's inline transform. Internal.
 */
class HeardEngine {
  private readonly endsAt: number;
  private flown = false;
  private readonly frames: ɵFrameLoop;

  constructor(
    private readonly host: HTMLElement,
    private readonly motion: NeatListeningMotion,
    words: number,
    private readonly origin: HTMLElement | null,
    deps: { readonly clock: ɵFrameClock; readonly document: Document },
    private readonly onDone: () => void,
  ) {
    const wordsEnd = Math.max(0, words - 1) * WORD_DELAY_MS + WORD_MS;
    this.endsAt =
      deps.clock.now() + Math.max(wordsEnd, motion === 'in-message-box' && origin ? FLIGHT_MS : 0);
    this.frames = new ɵFrameLoop(
      { ...deps, stopped: () => this.onDone() },
      () => this.frame(),
      () => this.moving(deps.clock.now()),
    );
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
  }

  private moving(now: number): boolean {
    return now < this.endsAt;
  }

  private frame(): void {
    if (this.motion === 'in-message-box' && !this.flown) this.fly();
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
