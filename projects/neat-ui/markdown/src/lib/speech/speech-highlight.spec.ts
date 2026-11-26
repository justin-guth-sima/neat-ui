import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDocument, steppedFrames } from '../motion/motion.testing';
import { SpeechHighlight } from './speech-highlight';
import { installHighlights, litText } from './speech.testing';

/** A reply as the template renders it: two paragraphs and karaoke's equalizer. */
function setup() {
  const registry = installHighlights();
  const host = document.createElement('div');
  host.innerHTML =
    '<p>Hello there my friend. How are you?</p><p>Next.</p>' +
    '<span class="speech-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  document.body.append(host);
  const clock = steppedFrames();
  const document_ = fakeDocument(document);
  let stops = 0;
  const engine = new SpeechHighlight({
    host,
    clock,
    document: document_ as unknown as Document,
    stopped: () => stops++,
  });
  const lit = (name: string) => litText(registry, `neat-speech-${name}`);
  const eq = host.querySelector<HTMLElement>('.speech-eq')!;
  return { registry, host, clock, document: document_, engine, lit, eq, stops: () => stops };
}

/** "Hello there my friend." is readable 0–22. */
const FIRST = { from: 0, to: 22 };

describe('SpeechHighlight', () => {
  beforeEach(() => {
    // Each character's line: the first paragraph's characters from 12 on wrap to a second line.
    // jsdom lays nothing out and gives a Range no box, so the spec gives it one.
    (Range.prototype as { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect =
      function (this: Range) {
        const top = this.startOffset >= 12 ? 30 : 10;
        return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20 } as DOMRect;
      };
  });

  afterEach(() => {
    delete (Range.prototype as { getBoundingClientRect?: unknown }).getBoundingClientRect;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('sentence tints the sentence, mutes the text after it, and runs no frames', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'sentence',
      still: false,
    });
    expect(t.lit('sentence')).toBe('Hello there my friend.');
    expect(t.lit('ahead')).toBe(' How are you?Next.');
    expect(t.lit('said')).toBe('');
    expect(t.clock.pending()).toBe(false);
    expect(t.engine.moving()).toBe(false);
  });

  it('waveform tints the sentence as sentence does; karaoke and word by word do not', () => {
    for (const [motion, tinted] of [
      ['waveform', 'Hello there my friend.'],
      ['karaoke', ''],
      ['word-by-word', ''],
    ] as const) {
      const t = setup();
      t.engine.update({ range: FIRST, startedAt: t.clock.now(), durationMs: 1000, motion, still: false });
      expect(t.lit('sentence'), motion).toBe(tinted);
      t.engine.destroy();
      document.body.replaceChildren();
    }
  });

  it('karaoke fills round(u × n) characters and moves the eq to the head’s line', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    expect(t.lit('ahead')).toBe(' How are you?Next.');
    t.clock.frame(250);
    expect(t.lit('said')).toBe('Hello ');
    expect(t.eq.style.transform).toBe('translateY(10px)');
    t.clock.frame(400);
    expect(t.lit('said')).toBe('Hello there my');
    expect(t.eq.style.transform).toBe('translateY(30px)');
  });

  it('an update reads no layout: the eq moves on the next frame', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 650,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    const reads = vi.fn();
    const box = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      reads();
      return box.call(this);
    };
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 650,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    expect(reads).not.toHaveBeenCalled();
    expect(t.lit('said')).toBe('Hello there my');
    t.clock.frame(16);
    expect(reads).toHaveBeenCalled();
    expect(t.eq.style.transform).toBe('translateY(30px)');
  });

  it("measures the sentence's lines in one go, not each time the head moves", () => {
    const t = setup();
    const reads = vi.fn();
    const box = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      reads();
      return box.call(this);
    };
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(100);
    const first = reads.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) t.clock.frame(40);
    expect(reads.mock.calls.length).toBe(first);
    expect(t.eq.style.transform).toBe('translateY(30px)');
    // A render of the same sentence keeps what was measured; another sentence measures again.
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(100);
    expect(reads.mock.calls.length).toBe(first);
    t.engine.update({
      range: { from: 22, to: 35 },
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(100);
    expect(reads.mock.calls.length).toBeGreaterThan(first);
  });

  it("the eq's bars beat on the engine's frames, each on its own, and rest once the sentence is said", () => {
    const t = setup();
    const bars = [...t.eq.querySelectorAll('i')];
    const scales = () =>
      bars.map((bar) => Number(/scaleY\(([^)]+)\)/.exec(bar.style.transform)?.[1]));
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(400);
    const first = scales();
    expect(new Set(first).size).toBe(4);
    for (const scale of first) {
      expect(scale).toBeGreaterThanOrEqual(3 / 13 - 1e-6);
      expect(scale).toBeLessThanOrEqual(1 + 1e-6);
    }
    t.clock.frame(100);
    expect(scales()).not.toEqual(first);
    // Bar 1 starts its beat at 0 ms: at 0.5 s it is at its tallest, at 1 s back at its lowest.
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 500,
      durationMs: 10_000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(16);
    expect(scales()[0]).toBeGreaterThan(0.95);
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 9000,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(16);
    const resting = scales();
    t.clock.frame(100);
    expect(scales()).toEqual(resting);
    expect(t.clock.pending()).toBe(false);
  });

  it('measures again when the reply gets another width, not when it grows taller', () => {
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        observe = () => undefined;
        disconnect = () => undefined;
      },
    );
    const t = setup();
    const reads = vi.fn();
    const box = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      reads();
      return box.call(this);
    };
    const resize = (width: number, height: number) =>
      observers[0](
        [{ contentRect: { width, height } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    resize(300, 100);
    t.clock.frame(100);
    const first = reads.mock.calls.length;
    resize(300, 140);
    t.clock.frame(100);
    expect(reads.mock.calls.length).toBe(first);
    resize(260, 140);
    t.clock.frame(100);
    expect(reads.mock.calls.length).toBeGreaterThan(first);
  });

  it('after the sentence is said, a render still places the eq once', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 5000,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(16);
    expect(t.eq.style.transform).toBe('translateY(30px)');
    t.eq.style.transform = '';
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 5000,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(16);
    expect(t.eq.style.transform).toBe('translateY(30px)');
    expect(t.clock.pending()).toBe(false);
  });

  it('word by word lights the word that holds the letter at u, and leaves later words pending', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 2200,
      motion: 'word-by-word',
      still: false,
    });
    t.clock.frame(400); // u = 0.18: letter 3, in "Hello"
    expect(t.lit('word')).toBe('Hello');
    expect(t.lit('pending')).toBe(' there my friend.');
    t.clock.frame(100); // letter 5, the space: the word before it
    expect(t.lit('word')).toBe('Hello');
    t.clock.frame(200); // letter 7, in "there"
    expect(t.lit('word')).toBe('there');
    expect(t.lit('pending')).toBe(' my friend.');
    expect(t.lit('ahead')).toBe(' How are you?Next.');
  });

  it('a startedAt in the future lights nothing said yet', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() + 500,
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(100);
    expect(t.lit('said')).toBe('');
    expect(t.clock.pending()).toBe(true);
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() + 500,
      durationMs: 1000,
      motion: 'word-by-word',
      still: false,
    });
    t.clock.frame(100);
    expect(t.lit('word')).toBe('');
    expect(t.lit('pending')).toBe('Hello there my friend.');
  });

  it('stops its frames at the sentence’s end, and runs none while hidden', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(100);
    t.document.setHidden(true);
    t.clock.frame(16);
    expect(t.clock.pending()).toBe(false);
    t.clock.frame(500);
    t.document.setHidden(false);
    t.clock.frame(16);
    // Back in view, where the clock says: 632 ms of 1000.
    expect(t.lit('said')).toBe('Hello there my');
    t.clock.frame(500);
    expect(t.lit('said')).toBe('Hello there my friend.');
    expect(t.clock.pending()).toBe(false);
    expect(t.stops()).toBe(1);
  });

  it('lights nothing and throws nothing for a range with no readable text', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(500);
    expect(() =>
      t.engine.update({
        range: null,
        startedAt: t.clock.now(),
        durationMs: 1000,
        motion: 'karaoke',
        still: false,
      }),
    ).not.toThrow();
    for (const name of ['sentence', 'ahead', 'pending', 'said', 'word']) expect(t.lit(name)).toBe('');
    // The frame already asked for runs once, draws nothing, and asks for no other.
    t.clock.frame(16);
    for (const name of ['sentence', 'ahead', 'pending', 'said', 'word']) expect(t.lit(name)).toBe('');
    expect(t.clock.pending()).toBe(false);
  });

  it('still shows the sentence form whatever the motion', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now() - 500,
      durationMs: 1000,
      motion: 'karaoke',
      still: true,
    });
    expect(t.lit('sentence')).toBe('Hello there my friend.');
    expect(t.lit('ahead')).toBe(' How are you?Next.');
    expect(t.lit('said')).toBe('');
    expect(t.clock.pending()).toBe(false);
  });

  it('destroy removes its ranges, its frames and its listener', () => {
    const t = setup();
    t.engine.update({
      range: FIRST,
      startedAt: t.clock.now(),
      durationMs: 1000,
      motion: 'karaoke',
      still: false,
    });
    t.clock.frame(300);
    t.engine.destroy();
    for (const name of ['ahead', 'said']) expect(t.lit(name)).toBe('');
    expect(t.clock.pending()).toBe(false);
    expect(t.document.listeners.size).toBe(0);
  });
});
