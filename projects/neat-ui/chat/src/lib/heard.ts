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

/** The glyphs a letter still being deciphered shows: the moments mockup's. */
export const HEARD_GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*';
/** How often two more letters show, and how many glyphs run ahead of them. */
const STEP_MS = 30;
const PER_STEP = 2;
const AHEAD = 10;
/** How many steps a glyph stays before it is renewed: every 60 ms, as decrypt's noise does. */
const RENEW_EVERY = 2;

/** The text as letters (graphemes), for the decipher. */
function lettersOf(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(text);
  return Array.from(
    new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
    (s) => s.segment,
  );
}

/**
 * A heard question arriving in the transcript: its letters deciphered out of glyphs, two more
 * every 30 ms, the next ten as glyphs. The text has its whole size from the first frame and every
 * letter stays in the accessibility tree. Internal to the transcript, which makes none under
 * reduced motion.
 */
@Component({
  selector: 'neat-chat-heard',
  templateUrl: './heard.html',
  styleUrl: './heard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeardArrival {
  /** What speech-to-text heard. */
  readonly text = input.required<string>();
  /** The arrival is over: the plain text shows. */
  readonly done = output<void>();

  protected readonly letters = computed(() => lettersOf(this.text()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const clock = inject(CHAT_CLOCK);
    const document = inject(DOCUMENT);
    const zone = inject(NgZone);
    let engine: HeardEngine | null = null;
    afterNextRender(() => {
      zone.runOutsideAngular(() => {
        engine = new HeardEngine(host, { clock, document }, () => zone.run(() => this.done.emit()));
      });
    });
    inject(DestroyRef).onDestroy(() => engine?.destroy());
  }
}

/** The decipher's frames: its letters and glyphs, and the end. It writes attributes. Internal. */
class HeardEngine {
  private readonly startedAt: number;
  private readonly letters: HTMLElement[];
  private shown = 0;
  private step = -1;
  private readonly frames: ɵFrameLoop;

  constructor(
    host: HTMLElement,
    deps: { readonly clock: ɵFrameClock; readonly document: Document },
    onDone: () => void,
  ) {
    this.startedAt = deps.clock.now();
    this.letters = [...host.querySelectorAll<HTMLElement>('span.c')];
    this.frames = new ɵFrameLoop(
      { ...deps, stopped: onDone },
      () => this.frame(deps.clock.now()),
      () => this.shown < this.letters.length,
    );
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
  }

  /** Two more letters every 30 ms, the next ten as glyphs, renewed every 60 ms. */
  private frame(now: number): void {
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
    // The glyphs are renewed every other step (60 ms): each renewal lays out the letters it
    // changes, and the steps between only give the letters that came ahead their first glyph.
    const renew = step % RENEW_EVERY === 0;
    for (let i = shown; i < end; i++) {
      const letter = this.letters[i];
      if (/\s/.test(letter.textContent ?? '')) continue;
      if (!renew && letter.hasAttribute('data-glyph')) continue;
      letter.setAttribute(
        'data-glyph',
        HEARD_GLYPHS[Math.floor(Math.random() * HEARD_GLYPHS.length)],
      );
    }
  }
}
