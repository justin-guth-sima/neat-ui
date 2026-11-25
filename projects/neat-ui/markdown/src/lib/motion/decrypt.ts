import type { MotionEngine, MotionHost } from './engine';
import { FrameLoop } from './frame-loop';

/** The glyphs a pending letter shows. */
const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/\\';
/** The glyphs of the tail, lower case among them. */
const NOISE = `${GLYPHS}abcdefghijkmnopqrstuvwxyz`;
/** How long the tail's noise is before it is fitted. */
const TAIL_LENGTH = 220;
/** The share of the tail's characters that are spaces, so it wraps like text. */
const TAIL_SPACES = 0.14;
/** How often the glyphs change (ms). */
const RENEW_MS = 60;
/** The share of what is left that resolves each frame. */
const RESOLVE_SHARE = 8;
/** How far below its first line the tail reaches: the rest of that line and the whole next. */
const TAIL_LINES = 1.5;

/** A piece as the engine reads it: its element, its text, where it sits, its glyphs. */
interface Piece {
  readonly element: HTMLElement;
  readonly noise: HTMLElement;
  readonly text: string;
  readonly from: number;
  readonly end: number;
  glyphs: string;
}

/**
 * The decrypt motion: pieces show as glyph noise that resolves from the start of the reply's
 * newest text, a frontier moving by an eighth of what is left each frame; while the text streams,
 * a tail of noise fills the rest of the last line and the whole next one, fitted again on every
 * frame. The glyphs are renewed every 60 ms. Frames run only while something is pending or the
 * tail shows, and the page is visible. Internal.
 */
export class DecryptEngine implements MotionEngine {
  private pieces: Piece[] = [];
  /** The glyphs of each piece element, kept across renders. */
  private readonly glyphsOf = new WeakMap<HTMLElement, string>();
  private tail: HTMLElement | null = null;
  private lineHeight = Number.NaN;
  /** Where the shown text is resolved to, in shown-prose offsets. */
  private frontier = 0;
  /** The highest piece index seen, to know the arrivals started again. */
  private newest = -1;
  private live = false;
  private tailNoise = '';
  private renewedAt = Number.NEGATIVE_INFINITY;
  private readonly frames: FrameLoop;

  constructor(private readonly deps: MotionHost) {
    this.frames = new FrameLoop(
      deps,
      () => this.apply(true),
      () => this.live || this.pieces.some((piece) => piece.end > this.frontier),
    );
  }

  rendered(streaming: boolean): void {
    const { host } = this.deps;
    this.pieces = [...host.querySelectorAll<HTMLElement>('span.piece')].map((element) =>
      this.read(element),
    );
    const newest = Math.max(
      -1,
      ...this.pieces.map((piece) => Number(piece.element.dataset['token'])),
    );
    // No pieces, or their count started again: a new text or a new motion; resolve from its pieces.
    if (this.pieces.length === 0 || newest < this.newest) this.frontier = 0;
    this.newest = newest;
    this.live = streaming && this.pieces.length > 0;
    this.tail = host.querySelector<HTMLElement>('span.tail');
    this.lineHeight = Number.parseFloat(getComputedStyle(host).lineHeight);
    this.apply(false);
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
    for (const piece of this.pieces) {
      piece.element.removeAttribute('data-pending');
      piece.noise.textContent = '';
    }
    if (this.tail) this.tail.textContent = '';
  }

  private read(element: HTMLElement): Piece {
    const text = element.querySelector('.real')?.textContent ?? '';
    const from = Number(element.dataset['from']);
    let glyphs = this.glyphsOf.get(element);
    if (glyphs === undefined || glyphs.length !== text.length) {
      glyphs = this.glyphs(text);
      this.glyphsOf.set(element, glyphs);
    }
    return {
      element,
      noise: element.querySelector<HTMLElement>('.noise')!,
      text,
      from,
      end: from + text.length,
      glyphs,
    };
  }

  /** Writes the pieces' and the tail's state; `advance` moves the frontier on by a frame. */
  private apply(advance: boolean): void {
    const pending = this.pieces.filter((piece) => piece.end > this.frontier);
    if (pending.length > 0) {
      // Text between pieces is plain already: the frontier skips it.
      this.frontier = Math.max(this.frontier, Math.min(...pending.map((piece) => piece.from)));
    }
    if (advance) {
      const end = Math.max(this.frontier, ...this.pieces.map((piece) => piece.end));
      const left = end - this.frontier;
      if (left > 0) this.frontier += Math.max(1, Math.ceil(left / RESOLVE_SHARE));
    }
    const now = this.deps.clock.now();
    const renew = now - this.renewedAt > RENEW_MS;
    if (renew) {
      this.renewedAt = now;
      this.tailNoise = this.tailGlyphs();
    }
    for (const piece of this.pieces) {
      if (piece.end > this.frontier) {
        if (renew) {
          piece.glyphs = this.glyphs(piece.text);
          this.glyphsOf.set(piece.element, piece.glyphs);
        }
        const resolved = Math.max(0, this.frontier - piece.from);
        piece.element.setAttribute('data-pending', '');
        write(piece.noise, piece.text.slice(0, resolved) + piece.glyphs.slice(resolved));
      } else {
        piece.element.removeAttribute('data-pending');
        write(piece.noise, '');
      }
    }
    if (this.tail) {
      if (this.live) this.fitTail(this.tail);
      else write(this.tail, '');
    }
  }

  /** The longest start of the noise whose last line begins above the limit. */
  private fitTail(tail: HTMLElement): void {
    const noise = this.tailNoise;
    tail.textContent = noise;
    const first = tail.getClientRects()[0];
    if (!first) return;
    const line = Number.isFinite(this.lineHeight) ? this.lineHeight : first.bottom - first.top;
    const limit = first.top + line * TAIL_LINES;
    let low = 0;
    let high = noise.length;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      tail.textContent = noise.slice(0, middle);
      const rects = tail.getClientRects();
      if (rects[rects.length - 1].top < limit) low = middle;
      else high = middle - 1;
    }
    tail.textContent = noise.slice(0, low);
  }

  /** A glyph for each letter of `text`, its spaces kept. */
  private glyphs(text: string): string {
    // By UTF-16 unit (no `u` flag), as the pieces are sliced.
    return text.replace(/\S/g, () => this.pick(GLYPHS));
  }

  private tailGlyphs(): string {
    let noise = '';
    for (let i = 0; i < TAIL_LENGTH; i++) {
      noise += this.deps.random() < TAIL_SPACES ? ' ' : this.pick(NOISE);
    }
    return noise;
  }

  private pick(from: string): string {
    return from[Math.floor(this.deps.random() * from.length)];
  }
}

function write(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}
