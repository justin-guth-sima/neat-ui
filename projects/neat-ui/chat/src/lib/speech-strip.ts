import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
} from '@angular/core';
import { ɵFrameLoop, type ɵFrameClock } from '@sima/neat-ui';
import type { NeatSpeech } from '@sima/neat-ui/markdown';
import { CHAT_CLOCK } from './chat-clock';
import { SizedCanvas } from './voice/sized-canvas';

/** The strip's bars, the quietest a bar is drawn, and its playhead's width (px). */
const BARS = 90;
const QUIETEST = 0.05;
const PLAYHEAD = 2;

/** The samples of a speech's audio, one channel. */
function samplesOf(audio: NeatSpeech['audio']): Float32Array {
  return 'getChannelData' in audio ? audio.getChannelData(0) : audio.samples;
}

/**
 * How long a speech's audio plays (ms). The same rule as `neat-markdown`'s, which an entry cannot
 * import: an AudioBuffer's duration, or the samples' length at their rate.
 */
function durationOf(audio: NeatSpeech['audio']): number {
  if ('getChannelData' in audio) return audio.duration * 1000;
  return audio.sampleRate > 0 ? (audio.samples.length / audio.sampleRate) * 1000 : 0;
}

/** One peak (max |sample|) per bar, scaled to the largest, at least 0.05. Internal. */
export function peaksOf(audio: NeatSpeech['audio'], bars: number): Float32Array {
  const samples = samplesOf(audio);
  const peaks = new Float32Array(bars);
  const per = samples.length / bars;
  let largest = 0;
  for (let bar = 0; bar < bars; bar++) {
    let peak = 0;
    const end = Math.min(samples.length, Math.floor((bar + 1) * per));
    for (let i = Math.floor(bar * per); i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    peaks[bar] = peak;
    largest = Math.max(largest, peak);
  }
  for (let bar = 0; bar < bars; bar++) {
    peaks[bar] = Math.max(QUIETEST, largest > 0 ? peaks[bar] / largest : 0);
  }
  return peaks;
}

/**
 * The waveform speaking motion's strip (moments mockup, speaking C): the sentence's audio as 90
 * bars on a canvas, those already said in `--primary`, the rest in `--neat-chip-neutral`, and a
 * playhead in `--foreground` where the voice is. Peaks and colors are read once per speech; frames
 * run while the sentence plays and the page is visible. Internal.
 */
export class SpeechStrip {
  private speech: NeatSpeech | null = null;
  private peaks: Float32Array = new Float32Array(BARS);
  private durationMs = 0;
  private said = '';
  private ahead = '';
  private head = '';
  private readonly canvas: SizedCanvas;
  private readonly frames: ɵFrameLoop;

  constructor(
    private readonly deps: {
      readonly canvas: HTMLCanvasElement;
      readonly clock: ɵFrameClock;
      readonly document: Document;
      readonly stopped: () => void;
    },
  ) {
    this.canvas = new SizedCanvas(() => deps.canvas);
    this.frames = new ɵFrameLoop(
      deps,
      () => this.draw(),
      () => this.progress() < 1,
    );
  }

  /** The sentence now playing; a new speech object reads its peaks and the colors again. */
  show(speech: NeatSpeech): void {
    if (speech !== this.speech) {
      this.speech = speech;
      this.peaks = peaksOf(speech.audio, BARS);
      this.durationMs = durationOf(speech.audio);
      const style = this.deps.canvas.ownerDocument.defaultView!.getComputedStyle(this.deps.canvas);
      this.said = style.getPropertyValue('--primary').trim();
      this.ahead = style.getPropertyValue('--neat-chip-neutral').trim();
      this.head = style.getPropertyValue('--foreground').trim();
    }
    this.draw();
    this.frames.start();
  }

  moving(): boolean {
    return this.frames.active;
  }

  destroy(): void {
    this.frames.destroy();
    this.canvas.destroy();
  }

  /** How far the sentence has played, 0 to 1. */
  private progress(): number {
    const speech = this.speech;
    if (!speech || this.durationMs <= 0) return 1;
    return Math.min(1, Math.max(0, (this.deps.clock.now() - speech.startedAt) / this.durationMs));
  }

  private draw(): void {
    const context = this.canvas.draw();
    if (!context) return;
    const { width, height } = this.canvas;
    const u = this.progress();
    context.clearRect(0, 0, width, height);
    const barWidth = Math.max(1.2, width / BARS - 1);
    let color = '';
    for (let i = 0; i < BARS; i++) {
      const wanted = i / BARS < u ? this.said : this.ahead;
      if (wanted !== color) context.fillStyle = color = wanted;
      const bar = 2 + this.peaks[i] * (height - 4);
      context.fillRect((i / BARS) * width, (height - bar) / 2, barWidth, bar);
    }
    context.fillStyle = this.head;
    context.fillRect(u * width - PLAYHEAD / 2, 0, PLAYHEAD, height);
  }
}

/**
 * The strip under a reply being read aloud in the `waveform` speaking motion: its canvas and the
 * strip that draws on it, made after the first render and dropped with the element. Internal to
 * the transcript, which renders none under reduced motion.
 */
@Component({
  selector: 'neat-chat-speech-strip',
  template: '<canvas class="speech-strip" aria-hidden="true"></canvas>',
  styleUrl: './speech-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpeechStripView {
  /** The sentence being said. */
  readonly speech = input.required<NeatSpeech>();

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const clock = inject(CHAT_CLOCK);
    const document = inject(DOCUMENT);
    const zone = inject(NgZone);
    let strip: SpeechStrip | null = null;
    afterNextRender(() => {
      const canvas = host.querySelector('canvas');
      if (!canvas) return;
      zone.runOutsideAngular(() => {
        strip = new SpeechStrip({ canvas, clock, document, stopped: () => undefined });
        strip.show(this.speech());
      });
    });
    effect(() => {
      const speech = this.speech();
      zone.runOutsideAngular(() => strip?.show(speech));
    });
    inject(DestroyRef).onDestroy(() => strip?.destroy());
  }
}
