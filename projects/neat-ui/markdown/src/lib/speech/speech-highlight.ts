import { ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
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
  private readonly ranges: HighlightRanges;
  private readonly frames: ɵFrameLoop;
  private lastHead = -1;
  private lastWord = -2;

  constructor(
    private readonly deps: {
      readonly host: HTMLElement;
      readonly clock: ɵFrameClock;
      readonly document: Document;
      readonly stopped: () => void;
    },
  ) {
    this.ranges = new HighlightRanges(deps.host.ownerDocument);
    this.frames = new ɵFrameLoop(
      deps,
      () => this.frame(),
      () => this.moves() && this.progress() < 1,
    );
  }

  /** After each render, and when the speech or the motion changes. */
  update(state: SpeechState): void {
    this.state = state;
    this.walk = readableNodes(this.deps.host);
    this.words = state.range ? wordsOf(this.walk, state.range) : [];
    this.lastHead = -1;
    this.lastWord = -2;
    const range = state.range;
    const walk = this.walk;
    this.ranges.set(
      'neat-speech-ahead',
      range ? present(readableDomRange(walk, range.to, walk.length)) : [],
    );
    if (!range || !this.moves()) {
      this.ranges.set('neat-speech-said', []);
      this.ranges.set('neat-speech-word', []);
      this.ranges.set('neat-speech-pending', []);
    }
    if (range && this.moves()) this.frame();
    this.frames.start();
  }

  /** Whether a frame can still change something. */
  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
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

  private frame(): void {
    const state = this.state;
    const walk = this.walk;
    const range = state?.range;
    if (!state || !walk || !range) return;
    const length = range.to - range.from;
    const u = this.progress();
    if (state.motion === 'karaoke') {
      const head = Math.round(u * length);
      if (head === this.lastHead) return;
      this.lastHead = head;
      this.ranges.set(
        'neat-speech-said',
        present(readableDomRange(walk, range.from, range.from + head)),
      );
      this.placeEq(walk, range.from + Math.max(0, head - 1));
    } else {
      const at = range.from + Math.floor(u * length);
      let current = -1;
      // Before the sentence starts to play, no word is said yet.
      const begun = this.deps.clock.now() >= state.startedAt;
      for (let i = 0; begun && i < this.words.length && this.words[i].from <= at; i++) current = i;
      if (current === this.lastWord) return;
      this.lastWord = current;
      const word = this.words[current];
      this.ranges.set(
        'neat-speech-word',
        word ? present(readableDomRange(walk, word.from, word.to)) : [],
      );
      const pendingFrom = word ? word.to : range.from;
      this.ranges.set(
        'neat-speech-pending',
        present(readableDomRange(walk, pendingFrom, range.to)),
      );
    }
  }

  /** Moves the equalizer to the top of the line that holds readable character `at`. */
  private placeEq(walk: ReadableNodes, at: number): void {
    const eq = this.deps.host.querySelector<HTMLElement>('.speech-eq');
    const char = readableDomRange(walk, at, at + 1);
    // A Range has a box in browsers; jsdom gives it none.
    if (!eq || !char || typeof char.getBoundingClientRect !== 'function') return;
    const top = char.getBoundingClientRect().top - this.deps.host.getBoundingClientRect().top;
    eq.style.transform = `translateY(${Math.round(top)}px)`;
  }
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
