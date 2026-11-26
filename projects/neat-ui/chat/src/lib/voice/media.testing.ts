import { vi } from 'vitest';
import { steppedFrames } from '../chat.testing';
import type { MicDeps, MicEvents } from './mic-recorder';

/*
 * What the voice and camera specs share: fakes of the browser's media APIs (getUserMedia, the
 * tracks and streams it gives, MediaRecorder, an AudioContext with its analyzer, a video element)
 * that a spec drives by hand. Internal, for specs only.
 */

/** A track the spec can end (unplugged) and whose `stop` it counts. */
export class FakeTrack extends EventTarget {
  readyState: 'live' | 'ended' = 'live';
  stops = 0;

  constructor(readonly kind: 'audio' | 'video' = 'audio') {
    super();
  }

  stop(): void {
    this.stops++;
    this.readyState = 'ended';
  }

  /** The device went away: the track ends by itself and says so. */
  end(): void {
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

/** A stream of fake tracks. */
export class FakeStream {
  readonly tracks: FakeTrack[];

  constructor(...kinds: ('audio' | 'video')[]) {
    this.tracks = (kinds.length ? kinds : (['audio'] as const)).map((kind) => new FakeTrack(kind));
  }

  getTracks(): FakeTrack[] {
    return this.tracks;
  }

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'audio');
  }

  getVideoTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === 'video');
  }

  /** Whether every track was stopped. */
  stopped(): boolean {
    return this.tracks.every((track) => track.stops > 0);
  }

  get asStream(): MediaStream {
    return this as unknown as MediaStream;
  }
}

/** A DOMException-like error with a name, as getUserMedia rejects with. */
export function mediaError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

/**
 * `mediaDevices` whose getUserMedia waits until the spec answers: `grant()` gives a new stream of
 * the kinds asked, `refuse(name)` rejects with that error. Each request is kept with its
 * constraints.
 */
export function fakeMediaDevices() {
  const requests: {
    readonly constraints: MediaStreamConstraints;
    readonly resolve: (stream: MediaStream) => void;
    readonly reject: (error: unknown) => void;
  }[] = [];
  const streams: FakeStream[] = [];
  const devices = {
    getUserMedia: vi.fn(
      (constraints: MediaStreamConstraints) =>
        new Promise<MediaStream>((resolve, reject) =>
          requests.push({ constraints, resolve, reject }),
        ),
    ),
    requests,
    streams,
    /** Answers the oldest open request with a new stream, and gives it. */
    grant(): FakeStream {
      const request = requests.shift();
      if (!request) throw new Error('no request waits');
      const kinds: ('audio' | 'video')[] = [];
      if (request.constraints.audio) kinds.push('audio');
      if (request.constraints.video) kinds.push('video');
      const stream = new FakeStream(...kinds);
      streams.push(stream);
      request.resolve(stream.asStream);
      return stream;
    },
    /** Refuses the oldest open request with an error of that name. */
    refuse(name: string): void {
      const request = requests.shift();
      if (!request) throw new Error('no request waits');
      request.reject(mediaError(name));
    },
  };
  return devices;
}

/** Lets the promises settled so far run their callbacks. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

/** A MediaRecorder that hands over one chunk when stopped, a microtask later, as browsers do. */
export class FakeMediaRecorder extends EventTarget {
  /** The types `isTypeSupported` accepts, set by the spec. */
  static supported = new Set<string>(['audio/webm;codecs=opus']);
  /** Every recorder made, newest last. */
  static made: FakeMediaRecorder[] = [];
  /** What the chunk a stop hands over holds. */
  static chunk = 'voice';

  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supported.has(type);
  }

  static reset(): void {
    FakeMediaRecorder.supported = new Set(['audio/webm;codecs=opus']);
    FakeMediaRecorder.made = [];
    FakeMediaRecorder.chunk = 'voice';
  }

  state: 'inactive' | 'recording' = 'inactive';
  readonly mimeType: string;

  constructor(
    readonly stream: MediaStream,
    readonly options?: MediaRecorderOptions,
  ) {
    super();
    this.mimeType = options?.mimeType ?? 'audio/browser-default';
    FakeMediaRecorder.made.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  /** Fails as a browser's recorder does on an encoder or track error: error, then stop. */
  fail(): void {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.dispatchEvent(new Event('error'));
      this.dispatchEvent(new Event('stop'));
    });
  }

  stop(): void {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    queueMicrotask(() => {
      const data = new Blob([FakeMediaRecorder.chunk], { type: this.mimeType });
      this.dispatchEvent(Object.assign(new Event('dataavailable'), { data }));
      this.dispatchEvent(new Event('stop'));
    });
  }
}

/** An analyzer whose time-domain samples come from the spec's `script`. */
export class FakeAnalyser {
  fftSize = 2048;
  connected = false;
  /** Fills a window of samples; silence by default. */
  script: (samples: Float32Array) => void = (samples) => samples.fill(0);

  getFloatTimeDomainData(samples: Float32Array): void {
    this.script(samples);
  }

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }
}

/** An AudioContext with a stream source and an analyzer, whose `resume` and `close` it counts. */
export class FakeAudioContext {
  static made: FakeAudioContext[] = [];
  state: 'running' | 'suspended' | 'closed' = 'suspended';
  resumes = 0;
  readonly analyzer = new FakeAnalyser();
  readonly sources: { readonly stream: MediaStream; connected: boolean }[] = [];

  constructor() {
    FakeAudioContext.made.push(this);
  }

  resume(): Promise<void> {
    this.resumes++;
    this.state = 'running';
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }

  createMediaStreamSource(stream: MediaStream) {
    const source = {
      stream,
      connected: false,
      connect: () => {
        source.connected = true;
      },
      disconnect: () => {
        source.connected = false;
      },
    };
    this.sources.push(source);
    return source;
  }

  createAnalyser(): FakeAnalyser {
    return this.analyzer;
  }

  get asContext(): AudioContext {
    return this as unknown as AudioContext;
  }
}

/** A sine of `amplitude` (1 is full scale) over the window. */
export function sine(amplitude = 1, period = 32): (samples: Float32Array) => void {
  return (samples) => {
    for (let i = 0; i < samples.length; i++)
      samples[i] = amplitude * Math.sin((2 * Math.PI * i) / period);
  };
}

/**
 * Everything a MicRecorder needs, faked: a secure context, getUserMedia the spec answers,
 * FakeMediaRecorder, a FakeAudioContext per recording, and a clock with timers that `advance(ms)`
 * moves on together.
 */
export function fakeMicDeps(overrides: Partial<MicDeps> = {}) {
  FakeMediaRecorder.reset();
  FakeAudioContext.made = [];
  const clock = steppedFrames();
  const timers = new Map<number, { readonly at: number; readonly run: () => void }>();
  let nextTimer = 1;
  const mediaDevices = fakeMediaDevices();
  const deps: MicDeps = {
    isSecureContext: true,
    mediaDevices,
    MediaRecorder: FakeMediaRecorder as unknown as MicDeps['MediaRecorder'],
    audioContext: () => new FakeAudioContext().asContext,
    clock,
    setTimeout: (run, ms) => {
      timers.set(nextTimer, { at: clock.now() + ms, run });
      return nextTimer++;
    },
    clearTimeout: (handle) => {
      timers.delete(handle);
    },
    ...overrides,
  };
  return {
    deps,
    clock,
    mediaDevices,
    timers,
    /** The newest audio context made. */
    context: () => FakeAudioContext.made.at(-1),
    /** The newest recorder made. */
    recorder: () => FakeMediaRecorder.made.at(-1),
    /** Moves the clock on by `ms`, running the timers that fall due, in order. */
    advance(ms: number) {
      const until = clock.now() + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        clock.frame(Math.max(0, due[1].at - clock.now()));
        timers.delete(due[0]);
        due[1].run();
      }
      clock.frame(Math.max(0, until - clock.now()));
    },
  };
}

/** Events of a MicRecorder, kept in order. */
export function micEvents() {
  const log: string[] = [];
  const recordings: { readonly blob: Blob; readonly durationMs: number }[] = [];
  const seconds: number[] = [];
  const events: MicEvents = {
    started: () => log.push('started'),
    second: (whole) => seconds.push(whole),
    recorded: (blob, durationMs) => {
      log.push('recorded');
      recordings.push({ blob, durationMs });
    },
    ended: (reason) => log.push(`ended:${reason}`),
  };
  return { events, log, recordings, seconds };
}
