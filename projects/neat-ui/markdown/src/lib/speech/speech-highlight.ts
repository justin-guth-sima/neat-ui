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
 * Karaoke's equalizer (the moments mockup's): four bars beating from 3 to 13 px and back every
 * 0.5 s, ease-in-out, each from its own delay. Drawn by the engine's frames rather than a CSS
 * animation, so the bars rest between sentences and no compositor animation competes with the
 * streaming text's frames.
 */
const EQ_BEAT_MS = 500;
const EQ_DELAYS_MS = [0, 150, 300, 100];
const EQ_LOW = 3 / 13;
const beat = NEAT_EASINGS['ease-in-out'];

/** A word of the sentence, as readable offsets. */
interface Word {
  readonly from: number;
  readonly to: number;
}

/**
 * The speaking motions over a reply's text, drawn with the CSS Custom Highlight API: no element is
 * added or changed, so nothing reflows and nothing leaves the accessibility tree. It lights the
 * reply after the sentence as `ahead` (muted), and as the clock moves through the sentence the
 * characters said (`karaoke`) or the word being said and those still to come (`word-by-word`); the
 * karaoke equalizer moves to the line of the fill's head. Frames run while the sentence is being
 * said and the page is visible; back in view it shows where the clock is. Internal.
 */
export class SpeechHighlight {
  private state: SpeechState | null = null;
  private walk: ReadableNodes | null = null;
  private words: Word[] = [];
  private wordsOf = '';
  private readonly ranges: HighlightRanges;
  private readonly frames: ɵFrameLoop;
  private lastHead = -1;
  private lastWord = -2;
  /** The moving looks lit now (said, word, pending), each with its readable offsets. */
  private readonly lit = new Map<SpeechHighlightName, { range: Range; from: number; to: number }>();
  /** The look the lit ranges were drawn for: the sentence, its start, the motion. */
  private litFor = '';
  /** The eq's line is to be found again, on the next frame: never in a render, where it would force a layout. */
  private eqDue = false;
  /**
   * Each character's line top in the sentence, relative to the host, measured in one go the first
   * time the eq is placed (one layout a sentence, not one each time the head moves); measured
   * again for another sentence or a host of another width.
   */
  private tops: Float32Array | null = null;
  private topsOf = '';
  /** The host's width the tops were measured at. */
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
            this.tops = null;
            this.eqDue = this.state?.motion === 'karaoke';
            this.frames.start();
          })
        : null;
    this.resizes?.observe(deps.host);
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => (this.moves() && this.progress() < 1) || this.eqDue,
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
    // A render that left the lit characters' text nodes in place (the reply grew after them)
    // keeps their ranges; anything else draws them again.
    const look = `${key}@${state.startedAt}:${state.motion}:${state.still}`;
    if (look !== this.litFor || ![...this.lit.values()].every((lit) => holds(walk, lit))) {
      this.lastHead = -1;
      this.lastWord = -2;
      this.litFor = look;
    }
    this.ranges.set(
      'neat-speech-ahead',
      range ? present(readableDomRange(walk, range.to, walk.length)) : [],
    );
    if (!range || !this.moves()) {
      for (const name of MOVING) this.show(name, null);
    }
    if (range && this.moves()) {
      this.light();
      this.eqDue = this.state.motion === 'karaoke';
    }
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

  /** Whether the look moves: karaoke or word by word, not still, with a sentence. */
  private moves(): boolean {
    const state = this.state;
    return (
      !!state?.range &&
      !state.still &&
      (state.motion === 'karaoke' || state.motion === 'word-by-word')
    );
  }

  /** How far the sentence is said, 0 to 1. */
  private progress(): number {
    const state = this.state;
    if (!state) return 1;
    if (state.durationMs <= 0) return 1;
    return Math.min(1, Math.max(0, (this.deps.clock.now() - state.startedAt) / state.durationMs));
  }

  /** A frame: the lit ranges where the clock is, and karaoke's eq on its line when that moved. */
  private frame(): void {
    const moved = this.light();
    const state = this.state;
    const walk = this.walk;
    const range = state?.range;
    if (!state || !walk || !range || state.motion !== 'karaoke' || state.still) return;
    this.beat(this.deps.clock.now() - state.startedAt);
    if (!moved && !this.eqDue) return;
    this.eqDue = false;
    this.placeEq(walk, range.from + Math.max(0, this.lastHead - 1));
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

  /** Lights what the clock says is said, reading no layout; whether it changed. */
  private light(): boolean {
    const state = this.state;
    const walk = this.walk;
    const range = state?.range;
    if (!state || !walk || !range || !this.moves()) return false;
    const length = range.to - range.from;
    const u = this.progress();
    if (state.motion === 'karaoke') {
      const head = Math.round(u * length);
      if (head === this.lastHead) return false;
      this.lastHead = head;
      this.show('neat-speech-said', walk, range.from, range.from + head);
      return true;
    } else {
      const at = range.from + Math.floor(u * length);
      let current = -1;
      // Before the sentence starts to play, no word is said yet.
      const begun = this.deps.clock.now() >= state.startedAt;
      for (let i = 0; begun && i < this.words.length && this.words[i].from <= at; i++) current = i;
      if (current === this.lastWord) return false;
      this.lastWord = current;
      const word = this.words[current];
      if (word) this.show('neat-speech-word', walk, word.from, word.to);
      else this.show('neat-speech-word', null);
      const pendingFrom = word ? word.to : range.from;
      this.show('neat-speech-pending', walk, pendingFrom, range.to);
      return true;
    }
  }

  /** Lights `[from, to)` as highlight `name`, or nothing without a walk. */
  private show(name: SpeechHighlightName, walk: ReadableNodes | null, from = 0, to = 0): void {
    const range = walk ? readableDomRange(walk, from, to) : null;
    this.ranges.set(name, present(range));
    if (range) this.lit.set(name, { range, from, to });
    else this.lit.delete(name);
  }

  /** Moves the equalizer to the top of the line that holds readable character `at`. */
  private placeEq(walk: ReadableNodes, at: number): void {
    const eq = this.deps.host.querySelector<HTMLElement>('.speech-eq');
    const range = this.state?.range;
    if (!eq || !range) return;
    const key = `${range.from}-${range.to}`;
    if (!this.tops || this.topsOf !== key) {
      this.tops = this.measure(walk, range);
      this.topsOf = key;
    }
    const top = this.tops?.[at - range.from];
    if (top === undefined || Number.isNaN(top)) return;
    eq.style.transform = `translateY(${Math.round(top)}px)`;
  }

  /** Each character's line top in the sentence, relative to the host; null without boxes (jsdom). */
  private measure(walk: ReadableNodes, range: { from: number; to: number }): Float32Array | null {
    const hostTop = this.deps.host.getBoundingClientRect().top;
    const tops = new Float32Array(range.to - range.from).fill(Number.NaN);
    for (let at = range.from; at < range.to; at++) {
      const char = readableDomRange(walk, at, at + 1);
      // A Range has a box in browsers; jsdom gives it none.
      if (!char || typeof char.getBoundingClientRect !== 'function') return null;
      tops[at - range.from] = char.getBoundingClientRect().top - hostTop;
    }
    return tops;
  }
}

/** The looks that move with the voice. */
const MOVING: readonly SpeechHighlightName[] = [
  'neat-speech-said',
  'neat-speech-word',
  'neat-speech-pending',
];

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
