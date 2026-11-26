import { NEAT_EASINGS, ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
import { HighlightRanges, type SpeechHighlightName } from './highlights';
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

/** The motions whose sentence is tinted as a whole, rather than walked word by word. */
const STILL_LOOKS: readonly NeatSpeakingMotion[] = ['sentence', 'equalizer', 'waveform'];

/** A word of the sentence, as readable offsets. */
interface Word {
  readonly from: number;
  readonly to: number;
}

/**
 * The speaking motions over a reply's text, drawn with the CSS Custom Highlight API: no element is
 * added or changed, so nothing reflows and nothing leaves the accessibility tree. It tints the
 * sentence being said (`sentence`, `equalizer`, `waveform`, and every motion under reduced
 * motion) and mutes the reply after it as `ahead`; `word-by-word` lights the word being said and
 * mutes those still to come as the clock moves through the sentence; the `equalizer`'s bars beat
 * beside the sentence's first line while it is said. Frames run while the sentence is
 * being said and the page is visible; back in view it shows where the clock is. Internal.
 */
export class SpeechHighlight {
  private state: SpeechState | null = null;
  private walk: ReadableNodes | null = null;
  private words: Word[] = [];
  private wordsOf = '';
  private readonly ranges: HighlightRanges;
  private readonly frames: ɵFrameLoop;
  private lastWord = -2;
  /** The moving looks lit now (word, pending), each with its readable offsets. */
  private readonly lit = new Map<SpeechHighlightName, { range: Range; from: number; to: number }>();
  /** The look the lit ranges were drawn for: the sentence, its start, the motion. */
  private litFor = '';
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
      () => ((this.walks() || this.beats()) && this.progress() < 1) || this.eqDue,
    );
  }

  /** After each render, and when the speech or the motion changes. */
  update(state: SpeechState): void {
    this.state = state;
    this.walk = readableNodes(this.deps.host);
    // A sentence's words are the same characters while its range is: found once a range.
    const key = state.range ? `${state.range.from}-${state.range.to}` : '';
    if (key !== this.wordsOf) {
      this.words = state.range ? wordsOf(this.walk, state.range) : [];
      this.wordsOf = key;
    }
    const range = state.range;
    const walk = this.walk;
    // A render that left the lit words' text nodes in place (the reply grew after them) keeps
    // their ranges; anything else draws them again.
    const look = `${key}@${state.startedAt}:${state.motion}:${state.still}`;
    if (look !== this.litFor || ![...this.lit.values()].every((lit) => holds(walk, lit))) {
      this.lastWord = -2;
      this.litFor = look;
    }
    this.ranges.set(
      'neat-speech-ahead',
      range ? present(readableDomRange(walk, range.to, walk.length)) : [],
    );
    const tinted = range && (state.still || STILL_LOOKS.includes(state.motion));
    const tint = this.tint;
    if (!tinted) this.tint = null;
    else if (!tint || tint.from !== range.from || tint.to !== range.to || !holds(walk, tint)) {
      const sentence = readableDomRange(walk, range.from, range.to);
      this.tint = sentence ? { range: sentence, ...range } : null;
    }
    if (this.tint !== tint || !tinted) {
      this.ranges.set('neat-speech-sentence', this.tint ? [this.tint.range] : []);
    }
    if (this.walks()) this.light();
    else for (const name of MOVING) this.show(name, null);
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

  /** Whether the words are walked: word by word, not still, with a sentence. */
  private walks(): boolean {
    const state = this.state;
    return !!state?.range && !state.still && state.motion === 'word-by-word';
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

  /** A frame: the word where the clock is, or the eq's bars and, when due, its line. */
  private frame(): void {
    if (this.walks()) this.light();
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

  /** Lights the word that holds the letter the clock is at, and the words still to come. */
  private light(): void {
    const state = this.state;
    const walk = this.walk;
    const range = state?.range;
    if (!state || !walk || !range) return;
    const u = this.progress();
    const at = range.from + Math.floor(u * (range.to - range.from));
    let current = -1;
    // Before the sentence starts to play, no word is said yet.
    const begun = this.deps.clock.now() >= state.startedAt;
    for (let i = 0; begun && i < this.words.length && this.words[i].from <= at; i++) current = i;
    if (current === this.lastWord) return;
    this.lastWord = current;
    const word = this.words[current];
    if (word) this.show('neat-speech-word', walk, word.from, word.to);
    else this.show('neat-speech-word', null);
    const pendingFrom = word ? word.to : range.from;
    this.show('neat-speech-pending', walk, pendingFrom, range.to);
  }

  /** Lights `[from, to)` as highlight `name`, or nothing without a walk. */
  private show(name: SpeechHighlightName, walk: ReadableNodes | null, from = 0, to = 0): void {
    const range = walk ? readableDomRange(walk, from, to) : null;
    this.ranges.set(name, present(range));
    if (range) this.lit.set(name, { range, from, to });
    else this.lit.delete(name);
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

/** The looks that move with the voice: word by word's. */
const MOVING: readonly SpeechHighlightName[] = ['neat-speech-word', 'neat-speech-pending'];

/** Whether a lit range still spans its readable offsets in this walk. */
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

/** The sentence's word-like segments, as readable offsets. */
function wordsOf(walk: ReadableNodes, range: { from: number; to: number }): Word[] {
  let text = '';
  for (let i = 0; i < walk.nodes.length; i++) {
    const start = walk.starts[i];
    const data = walk.nodes[i].data;
    const end = start + data.length;
    if (end <= range.from || start >= range.to) continue;
    text += data.slice(Math.max(0, range.from - start), Math.min(data.length, range.to - start));
  }
  const words: Word[] = [];
  if (typeof Intl.Segmenter === 'function') {
    for (const segment of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)) {
      if (!segment.isWordLike) continue;
      const from = range.from + segment.index;
      words.push({ from, to: from + segment.segment.length });
    }
  } else {
    for (const match of text.matchAll(/\S+/g)) {
      const from = range.from + (match.index ?? 0);
      words.push({ from, to: from + match[0].length });
    }
  }
  return words;
}
