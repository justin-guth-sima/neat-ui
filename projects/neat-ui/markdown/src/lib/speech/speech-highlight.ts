import { NEAT_EASINGS, ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
import { HighlightRanges } from './highlights';
import { readableDomRange, readableNodes, type ReadableNodes } from './readable-dom';
import type { NeatSpeakingMotion } from './speaking-motions';

/** What the engine shows: the sentence's readable range, when and how long it is said, the look. */
export interface SpeechState {
  /** Readable offsets, or null when the sentence holds no readable text. */
  readonly range: { readonly from: number; readonly to: number } | null;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly motion: NeatSpeakingMotion;
  /** Reduced motion: the still form, `sentence`, whatever the motion. */
  readonly still: boolean;
}

/**
 * The equalizer (karaoke's in the moments mockup): four bars beating from 3 to 13 px and back every
 * 0.5 s, ease-in-out, each from its own delay, beside the sentence's first line. Drawn by
 * the engine's frames rather than a CSS animation, so the bars rest between sentences and no
 * compositor animation competes with the streaming text's frames.
 */
const EQ_BEAT_MS = 500;
const EQ_DELAYS_MS = [0, 150, 300, 100];
const EQ_LOW = 3 / 13;
const beat = NEAT_EASINGS['ease-in-out'];

/**
 * The speaking motions over a reply's text, drawn with the CSS Custom Highlight API: no element is
 * added or changed, so nothing reflows and nothing leaves the accessibility tree. It tints the
 * sentence being said and mutes the reply after it as `ahead`; the `equalizer`'s bars beat beside
 * the sentence's first line while it is said. Frames run while the sentence is
 * being said and the page is visible; back in view it shows where the clock is. Internal.
 */
export class SpeechHighlight {
  private state: SpeechState | null = null;
  private walk: ReadableNodes | null = null;
  private readonly ranges: HighlightRanges;
  private readonly frames: ɵFrameLoop;
  /** The sentence's tint, kept while its text nodes stay (the reply grows after it). */
  private tint: { range: Range; from: number; to: number } | null = null;
  /** The eq's line is to be found again, on the next frame: never in a render, where it would force a layout. */
  private eqDue = false;
  /**
   * The top of the sentence's first line, relative to the host, measured once a sentence and
   * width the first time the eq is placed; null until then, or without boxes (jsdom).
   */
  private eqTop: number | null = null;
  private eqTopOf = '';
  /** The host's width the top was measured at. */
  private width = -1;
  private readonly resizes: ResizeObserver | null;

  constructor(
    private readonly deps: {
      readonly host: HTMLElement;
      readonly clock: ɵFrameClock;
      readonly document: Document;
      readonly stopped: () => void;
    },
  ) {
    this.ranges = new HighlightRanges(deps.host.ownerDocument);
    const view = deps.host.ownerDocument.defaultView;
    this.resizes =
      view && typeof view.ResizeObserver === 'function'
        ? new view.ResizeObserver(([entry]) => {
            // Only a new width moves the lines; a reply that grows taller leaves them be.
            if (entry.contentRect.width === this.width) return;
            this.width = entry.contentRect.width;
            this.eqTopOf = '';
            this.eqDue = this.beats();
            this.frames.start();
          })
        : null;
    this.resizes?.observe(deps.host);
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => (this.beats() && this.progress() < 1) || this.eqDue,
    );
  }

  /** After each render, and when the speech or the motion changes. */
  update(state: SpeechState): void {
    this.state = state;
    this.walk = readableNodes(this.deps.host);
    const range = state.range;
    const walk = this.walk;
    this.ranges.set(
      'neat-speech-ahead',
      range ? present(readableDomRange(walk, range.to, walk.length)) : [],
    );
    // A render that left the sentence's text nodes in place (the reply grew after it) keeps its tint.
    const tint = this.tint;
    if (!range) this.tint = null;
    else if (!tint || tint.from !== range.from || tint.to !== range.to || !holds(walk, tint)) {
      const sentence = readableDomRange(walk, range.from, range.to);
      this.tint = sentence ? { range: sentence, ...range } : null;
    }
    if (this.tint !== tint || !range) {
      this.ranges.set('neat-speech-sentence', this.tint ? [this.tint.range] : []);
    }
    this.eqDue = this.beats();
    this.frames.start();
  }

  /** Whether a frame can still change something. */
  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
    this.resizes?.disconnect();
    this.ranges.clear();
  }

  /** Whether the equalizer beats: not still, with a sentence. */
  private beats(): boolean {
    const state = this.state;
    return !!state?.range && !state.still && state.motion === 'equalizer';
  }

  /** How far the sentence is said, 0 to 1. */
  private progress(): number {
    const state = this.state;
    if (!state) return 1;
    if (state.durationMs <= 0) return 1;
    return Math.min(1, Math.max(0, (this.deps.clock.now() - state.startedAt) / state.durationMs));
  }

  /** A frame: the eq's bars and, when due, its line. */
  private frame(): void {
    const state = this.state;
    const walk = this.walk;
    const range = state?.range;
    if (!state || !walk || !range || !this.beats()) return;
    this.beat(this.deps.clock.now() - state.startedAt);
    if (!this.eqDue) return;
    this.eqDue = false;
    this.placeEq(walk, range);
  }

  /** The equalizer's bars at `ms` into the sentence. */
  private beat(ms: number): void {
    const bars = this.deps.host.querySelectorAll<HTMLElement>('.speech-eq i');
    bars.forEach((bar, i) => {
      const phase = (ms - (EQ_DELAYS_MS[i] ?? 0)) / EQ_BEAT_MS;
      const turn = Math.floor(phase);
      const along = phase < 0 ? 0 : turn % 2 === 0 ? phase - turn : 1 - (phase - turn);
      const scale = EQ_LOW + (1 - EQ_LOW) * beat(along);
      bar.style.transform = `scaleY(${Math.round(scale * 1e4) / 1e4})`;
    });
  }

  /** Moves the equalizer to the top of the sentence's first line. */
  private placeEq(walk: ReadableNodes, range: { from: number; to: number }): void {
    const eq = this.deps.host.querySelector<HTMLElement>('.speech-eq');
    if (!eq) return;
    const key = `${range.from}-${range.to}`;
    if (this.eqTopOf !== key) {
      this.eqTop = this.firstLineTop(walk, range);
      this.eqTopOf = key;
    }
    if (this.eqTop === null) return;
    eq.style.transform = `translateY(${Math.round(this.eqTop)}px)`;
  }

  /** The top of the sentence's first character, relative to the host; null without boxes (jsdom). */
  private firstLineTop(walk: ReadableNodes, range: { from: number; to: number }): number | null {
    const first = readableDomRange(walk, range.from, Math.min(range.to, range.from + 1));
    // A Range has a box in browsers; jsdom gives it none.
    if (!first || typeof first.getBoundingClientRect !== 'function') return null;
    return first.getBoundingClientRect().top - this.deps.host.getBoundingClientRect().top;
  }
}

/** Whether a tinted range still spans its readable offsets in this walk. */
function holds(walk: ReadableNodes, lit: { range: Range; from: number; to: number }): boolean {
  const now = readableDomRange(walk, lit.from, lit.to);
  return (
    !!now &&
    now.startContainer === lit.range.startContainer &&
    now.startOffset === lit.range.startOffset &&
    now.endContainer === lit.range.endContainer &&
    now.endOffset === lit.range.endOffset
  );
}

/** A range, or none. */
function present(range: Range | null): Range[] {
  return range ? [range] : [];
}
