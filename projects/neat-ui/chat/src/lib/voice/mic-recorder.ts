import type { ɵFrameClock } from '@sima/neat-ui';
import { type MediaProblem, mediaProblemOf } from './media-problem';

/** What the recorder takes from the browser, so a spec can give fakes. */
export interface MicDeps {
  readonly isSecureContext: boolean;
  readonly mediaDevices: Pick<MediaDevices, 'getUserMedia'> | undefined;
  readonly MediaRecorder:
    | {
        new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
        isTypeSupported(type: string): boolean;
      }
    | undefined;
  readonly audioContext: () => AudioContext;
  readonly clock: ɵFrameClock;
  readonly setTimeout: (run: () => void, ms: number) => number;
  readonly clearTimeout: (handle: number) => void;
}

/** What the recorder tells its owner. */
export interface MicEvents {
  /** The microphone was granted and recording began. */
  started(): void;
  /** Each whole second of a recording, counted from 1, while it records. */
  second(seconds: number): void;
  /** A recording ended and is long enough: its audio and its length. */
  recorded(blob: Blob, durationMs: number): void;
  /** A start or a recording ended without a recording, and why. */
  ended(reason: MicEnd): void;
}

/**
 * Why a start or a recording ended without a recording: canceled, too short, the recorder failed
 * on its own (an encoder or track error), or a problem with the microphone.
 */
export type MicEnd = 'canceled' | 'short' | 'failed' | MediaProblem;

/** Idle; waiting for the microphone; recording; handing the recording over. */
export type MicState = 'idle' | 'asking' | 'recording' | 'stopping';

/** The recording types, best first: Opus in WebM (Chrome, Firefox), Ogg, then MP4 (Safari). */
export const MIC_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'] as const;

/** A recording shorter than this is a slip, not a question. */
export const MIN_RECORDING_MS = 500;

/** The analyzer's window, in samples. */
const FFT_SIZE = 2048;
/** The level's floor: what reads as silence. */
const FLOOR_DBFS = -50;
/** The lowest level in dBFS reported, so silence is a finite number. */
const SILENCE_DBFS = -100;

/** One recording's browser objects. */
interface Take {
  readonly context: AudioContext;
  stream: MediaStream | null;
  analyzer: AnalyserNode | null;
  samples: Float32Array<ArrayBuffer> | null;
  recorder: MediaRecorder | null;
  readonly chunks: Blob[];
  startedAt: number;
  durationMs: number;
  timer: number | null;
  /** The next whole second's timer. */
  tick: number | null;
}

/**
 * The microphone, outside Angular: asks for it, records it with MediaRecorder and reads its level
 * through an analyzer, one recording at a time. The AudioContext is made at `start`, before it
 * asks, so the press's user activation lets it run. Every end stops every track and closes the
 * context, so the browser's microphone indicator goes off. Internal.
 */
export class MicRecorder {
  private current: MicState = 'idle';
  private take: Take | null = null;
  private readonly onTrackEnded = () => this.finish('missing');

  constructor(
    private readonly deps: MicDeps,
    private readonly events: MicEvents,
    private readonly options: { readonly maxMs: number },
  ) {}

  get state(): MicState {
    return this.current;
  }

  /** Asks for the microphone and records once it is granted; only from idle. */
  start(): void {
    if (this.current !== 'idle') return;
    const { deps } = this;
    if (!deps.isSecureContext) return this.events.ended('insecure');
    if (!deps.mediaDevices?.getUserMedia || !deps.MediaRecorder) {
      return this.events.ended('unsupported');
    }
    const context = deps.audioContext();
    context.resume().catch(() => undefined);
    const take: Take = {
      context,
      stream: null,
      analyzer: null,
      samples: null,
      recorder: null,
      chunks: [],
      startedAt: 0,
      durationMs: 0,
      timer: null,
      tick: null,
    };
    this.take = take;
    this.current = 'asking';
    // The browser's echo cancellation stays on: read aloud may be playing.
    deps.mediaDevices.getUserMedia({ audio: true }).then(
      (stream) => this.granted(take, stream),
      (error: unknown) => {
        if (this.take === take) this.finish(mediaProblemOf(error));
      },
    );
  }

  /** Ends the recording and hands it over; while asking, cancels. */
  stop(): void {
    if (this.current === 'asking') return this.finish('canceled');
    const take = this.take;
    if (this.current !== 'recording' || !take?.recorder) return;
    take.durationMs = this.deps.clock.now() - take.startedAt;
    if (take.durationMs < MIN_RECORDING_MS) return this.finish('short');
    // A recorder that already stopped on its own failed, and no stop event is coming.
    if (take.recorder.state === 'inactive') return this.finish('failed');
    this.current = 'stopping';
    this.clearTimer(take);
    take.recorder.stop();
    this.release(take);
  }

  /** Ends without a recording. */
  cancel(): void {
    if (this.current !== 'idle') this.finish('canceled');
  }

  /** The level now, 0 to 1: the RMS over the analyzer's window from -50 dBFS (0) to 0 dBFS (1). */
  level(): number | null {
    const dbfs = this.levelDbfs();
    if (dbfs === null) return null;
    return Math.min(1, Math.max(0, (dbfs - FLOOR_DBFS) / -FLOOR_DBFS));
  }

  /** The same level in dBFS (`NeatLevelMeter`'s scale); null unless recording. */
  levelDbfs(): number | null {
    const take = this.take;
    if (this.current !== 'recording' || !take?.analyzer || !take.samples) return null;
    const samples = take.samples;
    take.analyzer.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    const rms = Math.sqrt(sum / samples.length);
    return rms > 0 ? Math.max(SILENCE_DBFS, 20 * Math.log10(rms)) : SILENCE_DBFS;
  }

  /** Ends without a recording or a word, as the owner goes. */
  destroy(): void {
    const take = this.take;
    this.take = null;
    this.current = 'idle';
    if (take) this.release(take, true);
  }

  private granted(take: Take, stream: MediaStream): void {
    take.stream = stream;
    if (this.take !== take) {
      // Stopped or gone while asking: the microphone goes straight back.
      stopTracks(stream);
      return;
    }
    const { deps } = this;
    const Recorder = deps.MediaRecorder!;
    try {
      const source = take.context.createMediaStreamSource(stream);
      const analyzer = take.context.createAnalyser();
      analyzer.fftSize = FFT_SIZE;
      source.connect(analyzer);
      take.analyzer = analyzer;
      take.samples = new Float32Array(analyzer.fftSize);
      const type = MIC_TYPES.find((candidate) => Recorder.isTypeSupported(candidate));
      const recorder = new Recorder(stream, type ? { mimeType: type } : undefined);
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) take.chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => this.stopped(take));
      take.recorder = recorder;
      recorder.start();
    } catch {
      this.finish('unsupported');
      return;
    }
    for (const track of stream.getTracks()) track.addEventListener('ended', this.onTrackEnded);
    take.startedAt = deps.clock.now();
    take.timer = deps.setTimeout(() => this.stop(), this.options.maxMs);
    this.tickAfter(take, 1);
    this.current = 'recording';
    this.events.started();
  }

  /** Tells second `seconds` of the take once it has passed, then waits for the next. */
  private tickAfter(take: Take, seconds: number): void {
    const due = take.startedAt + seconds * 1000;
    take.tick = this.deps.setTimeout(
      () => {
        take.tick = null;
        if (this.take !== take || this.current !== 'recording') return;
        this.events.second(seconds);
        this.tickAfter(take, seconds + 1);
      },
      Math.max(0, due - this.deps.clock.now()),
    );
  }

  /** The recorder stopped: as asked, it hands the recording over; on its own, it failed. */
  private stopped(take: Take): void {
    if (this.take !== take) return;
    if (this.current !== 'stopping') return this.finish('failed');
    const blob = new Blob(take.chunks, { type: take.recorder?.mimeType ?? '' });
    this.take = null;
    this.current = 'idle';
    this.events.recorded(blob, take.durationMs);
  }

  /** Ends the current take without a recording and says why. */
  private finish(reason: MicEnd): void {
    const take = this.take;
    this.take = null;
    this.current = 'idle';
    if (take) this.release(take, true);
    this.events.ended(reason);
  }

  /** Stops the tracks, the timer and the context; `discard` also drops what was recorded. */
  private release(take: Take, discard = false): void {
    this.clearTimer(take);
    if (discard && take.recorder && take.recorder.state !== 'inactive') take.recorder.stop();
    if (take.stream) {
      for (const track of take.stream.getTracks()) {
        track.removeEventListener('ended', this.onTrackEnded);
      }
      stopTracks(take.stream);
    }
    if (take.context.state !== 'closed') take.context.close().catch(() => undefined);
  }

  private clearTimer(take: Take): void {
    if (take.timer !== null) this.deps.clearTimeout(take.timer);
    if (take.tick !== null) this.deps.clearTimeout(take.tick);
    take.timer = null;
    take.tick = null;
  }
}

/** Stops every track of a stream, so the browser's indicator goes off. */
function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
