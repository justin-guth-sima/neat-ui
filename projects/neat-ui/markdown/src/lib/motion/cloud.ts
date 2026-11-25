import { COMMON_WORDS } from './common-words';
import type { MotionEngine, MotionHost } from './engine';
import { FrameLoop } from './frame-loop';
import { TEXT_MOTIONS } from './text-motions';

/** How long a flight takes, and a piece waits for it: the word cloud's settle time (ms). */
const FLIGHT_MS = TEXT_MOTIONS['word-cloud'].settleMs;
/** How long the cloud fades out once the text stops streaming (ms). */
const FADE_MS = 400;
/** The anchor: this far right of the newest line's start and below it, kept this far inside. */
const ANCHOR_RIGHT = 30;
const ANCHOR_BELOW = 26;
const ANCHOR_INSIDE = 90;
/** How much of the way to its aim the anchor moves each frame. */
const ANCHOR_EASE = 0.12;
/** A word's orbit: its radius, its turn per frame step, how it is squashed, its wobble. */
const RADIUS_MIN = 26;
const RADIUS_SPREAD = 44;
const TURN_MIN = 0.3;
const TURN_SPREAD = 0.4;
const TURN_STEP = 0.016;
const SQUASH_X = 1.7;
const SQUASH_Y = 0.4;
const WOBBLE = 4;
const WOBBLE_MS = 600;
/** Words stay this far inside the host's sides. */
const WORD_INSIDE = 30;
/** A word's font size: 11 to 15 px of the mockup's 15 px text. */
const SIZE_MIN = 11 / 15;
const SIZE_SPREAD = 4 / 15;

/** A flight's state: free, at its start (shown there for a frame), on its way. */
const FREE = 0;
const AT_START = 1;
const FLYING = 2;

/**
 * The word cloud motion: words from `COMMON_WORDS` orbit an anchor under the reply's newest line;
 * with each new piece one of them flies into the piece's place and takes a new word. The engine
 * writes the words' and flights' text, attributes, transforms and opacity; the template renders
 * them empty for it, and the piece's own CSS keeps it hidden until its flight lands. Internal.
 */
export class CloudEngine implements MotionEngine {
  private readonly words: HTMLElement[];
  private readonly flights: HTMLElement[];
  private cloud: HTMLElement | null = null;
  private readonly phase: Float32Array;
  private readonly radius: Float32Array;
  private readonly angle: Float32Array;
  private readonly turn: Float32Array;
  private readonly wordX: Float32Array;
  private readonly wordY: Float32Array;
  private readonly flightState: Uint8Array;
  private readonly flightStartAt: Float64Array;
  private readonly flightWord: Int16Array;
  private readonly flightToX: Float32Array;
  private readonly flightToY: Float32Array;
  private anchorX = 0;
  private anchorY = 0;
  private aimX = 0;
  private aimY = 0;
  private anchored = false;
  private width = 0;
  private lineHeight = Number.NaN;
  /** The highest piece index seen, and the pieces' epoch it counts in. */
  private newest = -1;
  private epoch: number | null = null;
  private live = false;
  /** Whether the cloud shows: while the text streams and the anchor has a line to follow. */
  private shown = false;
  private offAt = Number.NEGATIVE_INFINITY;
  private readonly frames: FrameLoop;

  constructor(
    private readonly deps: MotionHost,
    count: number,
  ) {
    this.words = [];
    this.flights = [];
    this.phase = new Float32Array(count);
    this.radius = new Float32Array(count);
    this.angle = new Float32Array(count);
    this.turn = new Float32Array(count);
    this.wordX = new Float32Array(count);
    this.wordY = new Float32Array(count);
    const { random } = deps;
    for (let i = 0; i < count; i++) {
      this.phase[i] = random() * 2 * Math.PI;
      this.radius[i] = RADIUS_MIN + random() * RADIUS_SPREAD;
      this.angle[i] = random() * 2 * Math.PI;
      this.turn[i] = (random() < 0.5 ? -1 : 1) * (TURN_MIN + random() * TURN_SPREAD);
    }
    const pool = deps.host.querySelectorAll('.cloud-flight').length;
    this.flightState = new Uint8Array(pool);
    this.flightStartAt = new Float64Array(pool);
    this.flightWord = new Int16Array(pool);
    this.flightToX = new Float32Array(pool);
    this.flightToY = new Float32Array(pool);
    this.bind();
    this.frames = new FrameLoop(
      deps,
      () => this.frame(),
      () =>
        this.live ||
        this.deps.clock.now() < this.offAt + FADE_MS ||
        this.flightState.some((state) => state !== FREE),
    );
  }

  moving(): boolean {
    return this.frames.active;
  }

  rendered(streaming: boolean, epoch: number): void {
    this.bind();
    const { host, clock } = this.deps;
    const hostBox = host.getBoundingClientRect();
    this.width = hostBox.width;
    this.lineHeight = Number.parseFloat(getComputedStyle(host).lineHeight);
    if (this.live && !streaming) this.offAt = clock.now();
    this.live = streaming;
    const pieces = host.querySelectorAll<HTMLElement>('span.piece');
    let newest = -1;
    for (const piece of pieces) newest = Math.max(newest, Number(piece.dataset['token']));
    if (epoch !== this.epoch) this.restart(epoch);
    const fresh = this.frames.fresh();
    for (const piece of pieces) {
      if (Number(piece.dataset['token']) <= this.newest) continue;
      const rects = piece.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) continue;
      this.aimAt(last, hostBox);
      if (!fresh || !this.fly(piece, rects, hostBox)) piece.setAttribute('data-unflown', '');
    }
    this.newest = Math.max(this.newest, newest);
    const shown = this.live && this.anchored;
    if (shown !== this.shown) {
      this.shown = shown;
      this.cloud?.toggleAttribute('data-on', shown);
    }
    this.frames.start();
  }

  destroy(): void {
    this.frames.destroy();
  }

  /** Finds the cloud the template rendered, and gives its words their text and size once. */
  private bind(): void {
    const cloud = this.deps.host.querySelector<HTMLElement>('div.cloud');
    if (cloud === this.cloud) return;
    this.cloud = cloud;
    this.words.splice(
      0,
      this.words.length,
      ...(cloud?.querySelectorAll<HTMLElement>('.cloud-word') ?? []),
    );
    this.flights.splice(
      0,
      this.flights.length,
      ...(cloud?.querySelectorAll<HTMLElement>('.cloud-flight') ?? []),
    );
    this.words.forEach((word, i) => {
      word.textContent = this.commonWord();
      word.style.fontSize = `${SIZE_MIN + this.deps.random() * SIZE_SPREAD}em`;
      if (i >= this.radius.length) word.style.opacity = '0';
    });
  }

  /**
   * The pieces start again (a text written anew): no flight lands, each word in the air goes back
   * to the cloud, and the anchor goes to the next piece's line at once.
   */
  private restart(epoch: number): void {
    this.epoch = epoch;
    this.newest = -1;
    this.anchored = false;
    for (let slot = 0; slot < this.flightState.length; slot++) {
      if (this.flightState[slot] === FREE) continue;
      this.free(slot);
    }
  }

  /** A flight is done: it empties, and its word shows again with a new word. */
  private free(slot: number): void {
    const flight = this.flights[slot];
    flight.removeAttribute('data-start');
    flight.removeAttribute('data-busy');
    flight.removeAttribute('data-land');
    flight.textContent = '';
    const word = this.words[this.flightWord[slot]];
    word.textContent = this.commonWord();
    word.style.opacity = '';
    this.flightState[slot] = FREE;
  }

  /** Aims the anchor at the newest line: right of its start and below it, inside the host. */
  private aimAt(line: DOMRect, hostBox: DOMRect): void {
    this.aimX = Math.min(
      this.width - ANCHOR_INSIDE,
      Math.max(ANCHOR_INSIDE, line.left - hostBox.left + ANCHOR_RIGHT),
    );
    this.aimY = line.bottom - hostBox.top + ANCHOR_BELOW;
    if (!this.anchored) {
      this.anchored = true;
      this.anchorX = this.aimX;
      this.anchorY = this.aimY;
    }
  }

  /** Sends a free flight from a cloud word to the piece's last line; false when none is free. */
  private fly(piece: HTMLElement, rects: DOMRectList, hostBox: DOMRect): boolean {
    const slot = this.flightState.indexOf(FREE);
    const count = Math.min(this.words.length, this.radius.length);
    if (slot < 0 || count === 0) return false;
    const flight = this.flights[slot];
    const word = Math.floor(this.deps.random() * count);
    const text = piece.textContent ?? '';
    flight.textContent = rects.length > 1 ? text.trim() : text;
    flight.setAttribute('data-start', '');
    flight.setAttribute('data-busy', '');
    flight.removeAttribute('data-land');
    const width = flight.offsetWidth;
    const height = flight.offsetHeight;
    flight.style.transform = `translate(${this.wordX[word] - width / 2}px, ${this.wordY[word] - height / 2}px)`;
    this.words[word].style.opacity = '0';
    const last = rects[rects.length - 1];
    const line = Number.isFinite(this.lineHeight) ? this.lineHeight : last.height;
    this.flightToX[slot] = (rects.length > 1 ? last.left : last.right - width) - hostBox.left;
    this.flightToY[slot] = last.top - hostBox.top - (line - last.height) / 2;
    this.flightWord[slot] = word;
    this.flightStartAt[slot] = this.deps.clock.now();
    this.flightState[slot] = AT_START;
    return true;
  }

  private frame(): void {
    const now = this.deps.clock.now();
    this.anchorX += (this.aimX - this.anchorX) * ANCHOR_EASE;
    this.anchorY += (this.aimY - this.anchorY) * ANCHOR_EASE;
    const count = Math.min(this.words.length, this.radius.length);
    for (let i = 0; i < count; i++) {
      this.angle[i] += this.turn[i] * TURN_STEP;
      const x = Math.min(
        this.width - WORD_INSIDE,
        Math.max(WORD_INSIDE, this.anchorX + Math.cos(this.angle[i]) * this.radius[i] * SQUASH_X),
      );
      const y =
        this.anchorY +
        Math.sin(this.angle[i]) * this.radius[i] * SQUASH_Y +
        Math.sin(now / WOBBLE_MS + this.phase[i]) * WOBBLE;
      this.wordX[i] = x;
      this.wordY[i] = y;
      this.words[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
    for (let slot = 0; slot < this.flightState.length; slot++) {
      const state = this.flightState[slot];
      if (state === FREE) continue;
      const flight = this.flights[slot];
      if (state === AT_START) {
        // Its start was shown: now it flies, by the transition in the CSS.
        flight.removeAttribute('data-start');
        flight.setAttribute('data-land', '');
        flight.style.transform = `translate(${this.flightToX[slot]}px, ${this.flightToY[slot]}px)`;
        this.flightState[slot] = FLYING;
      } else if (now - this.flightStartAt[slot] >= FLIGHT_MS) {
        // Landed: the piece shows by its own CSS, the word takes a new one.
        this.free(slot);
      }
    }
  }

  private commonWord(): string {
    return COMMON_WORDS[Math.floor(this.deps.random() * COMMON_WORDS.length)];
  }
}
