import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NeatSpeech } from '@sima/neat-ui/markdown';
import { steppedFrames } from './chat.testing';
import { peaksOf, SpeechStrip } from './speech-strip';
import { boxOf, recordingContext, visibleDocument } from './voice/listening.testing';

/** Samples whose bar `i` of `bars` peaks at `(i + 1) / bars`. */
function rising(bars: number, perBar = 10): Float32Array {
  const samples = new Float32Array(bars * perBar);
  for (let i = 0; i < bars; i++) samples[i * perBar + 3] = -((i + 1) / bars) * 0.5;
  return samples;
}

function setup() {
  const canvas = document.createElement('canvas');
  canvas.style.setProperty('--primary', 'orange');
  canvas.style.setProperty('--neat-chip-neutral', 'gray');
  canvas.style.setProperty('--foreground', 'white');
  document.body.append(canvas);
  boxOf(canvas, 180, 34);
  const context = recordingContext(canvas);
  const clock = steppedFrames();
  const document_ = visibleDocument(document);
  let stops = 0;
  const strip = new SpeechStrip({
    canvas,
    clock,
    document: document_ as unknown as Document,
    stopped: () => stops++,
  });
  const speech = (ms = 1000): NeatSpeech => ({
    from: 0,
    to: 10,
    startedAt: clock.now(),
    audio: { samples: rising(90), sampleRate: 900 * (1000 / ms) },
  });
  return { canvas, context, clock, document: document_, strip, speech, stops: () => stops };
}

describe('the speech strip', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('peaksOf takes one peak per bar scaled to the largest', () => {
    const peaks = peaksOf({ samples: rising(90), sampleRate: 16_000 }, 90);
    expect(peaks).toHaveLength(90);
    expect(peaks[89]).toBeCloseTo(1, 5);
    expect(peaks[44]).toBeCloseTo(45 / 90, 5);
    expect(peaks[0]).toBeCloseTo(0.05, 5);
    const buffer = {
      duration: 1,
      sampleRate: 900,
      length: 900,
      numberOfChannels: 1,
      getChannelData: () => rising(90),
    } as unknown as AudioBuffer;
    expect([...peaksOf(buffer, 90)]).toEqual([...peaks]);
    for (const quiet of peaksOf({ samples: new Float32Array(900), sampleRate: 900 }, 3)) {
      expect(quiet).toBeCloseTo(0.05, 5);
    }
  });

  it('draws the said bars in primary and a playhead at u', () => {
    const t = setup();
    t.strip.show(t.speech(1000));
    t.context.clear();
    t.clock.frame(500);
    const fills = t.context.calls.filter(
      (call) => call.name === '=fillStyle' || call.name === 'fillRect',
    );
    // Bars before the playhead in primary, the rest neutral, then the playhead.
    const colorOfBar = (i: number) => {
      let color = '';
      let bar = -1;
      for (const call of fills) {
        if (call.name === '=fillStyle') color = call.args[0] as string;
        else if (++bar === i) return color;
      }
      return null;
    };
    expect(colorOfBar(0)).toBe('orange');
    expect(colorOfBar(44)).toBe('orange');
    expect(colorOfBar(45)).toBe('gray');
    expect(colorOfBar(89)).toBe('gray');
    const rects = t.context.named('fillRect').map((call) => call.args as number[]);
    expect(rects).toHaveLength(91);
    expect(rects[90]).toEqual([89, 0, 2, 34]);
    expect(colorOfBar(90)).toBe('white');
    expect(rects[0][2]).toBeCloseTo(1.2, 5);
    expect(rects[89][3]).toBeCloseTo(32, 5);
  });

  it('stops at the end and runs no frames while hidden', () => {
    const t = setup();
    t.strip.show(t.speech(1000));
    t.clock.frame(100);
    t.document.setHidden(true);
    t.clock.frame(16);
    expect(t.clock.pending()).toBe(false);
    t.document.setHidden(false);
    t.clock.frame(2000);
    expect(t.clock.pending()).toBe(false);
    expect(t.stops()).toBe(1);
    expect(t.strip.moving()).toBe(false);
  });

  it('computes the peaks once per speech, and reads its colors once per speech', () => {
    const t = setup();
    const speech = t.speech(1000);
    const read = vi.spyOn(window, 'getComputedStyle');
    let reads = 0;
    const samples = speech.audio as { samples: Float32Array };
    const original = samples.samples;
    Object.defineProperty(samples, 'samples', {
      get: () => {
        reads++;
        return original;
      },
    });
    t.strip.show(speech);
    const once = reads;
    expect(once).toBeGreaterThan(0);
    t.strip.show(speech);
    for (let i = 0; i < 5; i++) t.clock.frame(16);
    expect(reads).toBe(once);
    expect(read).toHaveBeenCalledTimes(1);
    t.strip.show({ ...speech });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
