import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NEAT_LISTENING_MOTIONS,
  NEAT_MESSAGE_BOX_GLOWS,
  NEAT_PICTURE_MOTIONS,
  NeatChatTranscript,
  NeatMessageBox,
  type NeatChatMessage,
  type NeatListeningMotion,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
  type NeatPictureMotion,
} from '@sima/neat-ui/chat';
import {
  NEAT_SPEAKING_MOTIONS,
  NEAT_TEXT_MOTIONS,
  neatSpeakable,
  type NeatSpeakingMotion,
  type NeatSpeech,
  type NeatTextMotion,
} from '@sima/neat-ui/markdown';
import { CallbackTimer } from '../measure/callback-timer';
import { calibrateRefresh, FrameRecorder, type Refresh } from '../measure/frame-recorder';
import { LoafCollector, type LoafSummary } from '../measure/loaf-collector';
import { type FrameStats, frameStats, percentile, type Tier, tierOf } from '../measure/stats';
import { type ChatReply, ChatLoad } from '../synth/chat-load';
import { mulberry32 } from '../synth/prng';
import { NO_FRAMES } from './bev-host';

/** How long the page settles (and calibrates the refresh) before the reply waits. */
export const CHAT_WARMUP_MS = 2000;
/** How long a looping page (`measure=0`) rests after a reply before it asks again. */
const LOOP_PAUSE_MS = 2000;
/** A listen run: how long the box records, how long it transcribes, and the heard phase. */
export const LISTEN_MS = 3000;
export const TRANSCRIBE_MS = 300;
export const HEARD_MS = 1500;
/** A speak run: how long after the reply the speech that remains is measured. */
export const SPEAKING_MS = 3000;
/** How long a sentence takes to say: 55 ms a character, the moments mockup's pace. */
const MS_PER_CHARACTER = 55;
/** The pretend voice's sample rate. */
const VOICE_RATE = 8000;
/** The question a listen run hears. */
export const HEARD_QUESTION = "What's on this shelf, and which of it would you cook with?";

/** What the page's query says: the variants and the load. */
export interface ChatQuery {
  readonly text: NeatTextMotion;
  readonly picture: NeatPictureMotion;
  readonly glow: NeatMessageBoxGlow;
  /** Pieces a second. */
  readonly rate: number;
  /** How long the reply waits for its first word, ms. */
  readonly wait: number;
  /** How many pieces a prose reply has. */
  readonly pieces: number;
  readonly reply: ChatReply;
  /** A listen run's listening motion: the box records before the question; `none` for none. */
  readonly listen: NeatListeningMotion | 'none';
  /** A speak run's speaking motion: the reply is read aloud as it streams; `none` for none. */
  readonly speak: NeatSpeakingMotion | 'none';
  /** Measure once, or loop for viewing. */
  readonly measure: boolean;
}

/** One phase's measurement: the frames shown, their tier, and the script of each frame. */
export interface ChatPhaseResult {
  readonly frames: FrameStats;
  readonly tier: Tier;
  /** Each frame's script in its animation-frame callbacks, ms. */
  readonly script: { readonly p50: number; readonly p95: number; readonly worst: number };
}

/** A listen run's recording, decoded in the page. */
export interface ChatRecorded {
  readonly bytes: number;
  readonly type: string;
  /** Its length as the browser decodes it, ms. */
  readonly decodedMs: number;
}

/** What the chat page's measurement found, as the page shows it and `benchChat` holds it. */
export interface ChatBenchResult {
  readonly hz: number;
  /** A listen run: while the box records, in the listening motion. */
  readonly listening?: ChatPhaseResult;
  /** A listen run: while the heard question arrives in the transcript. */
  readonly heard?: ChatPhaseResult;
  /** While the reply waits: the orb and clock, the glow, the picture's reading. */
  readonly waiting: ChatPhaseResult;
  /** While the reply streams in its text motion, with the long frames that came. */
  readonly streaming: ChatPhaseResult & { readonly loafs: LoafSummary };
  /** A speak run: the speech that remains after the reply, for 3 s. */
  readonly speaking?: ChatPhaseResult;
  /** A listen run's recording. */
  readonly recorded?: ChatRecorded;
}

/** The phases a run measures, in the order they come. */
type PhaseName = 'listening' | 'heard' | 'waiting' | 'streaming' | 'speaking';

declare global {
  interface Window {
    /** The chat page's measurement once it is done (`page.waitForFunction` waits for it). */
    benchChat?: ChatBenchResult;
  }
}

const QUESTION: NeatChatMessage = {
  id: 'question',
  role: 'user',
  text: "What's on this shelf, and what could I cook with it?",
  pictures: [{ id: 'shelf', src: 'examples/shelf.webp', name: 'A kitchen shelf' }],
};

/**
 * The chat parts' measured page (`/#/chat`): a transcript and a message box as an app has them,
 * a question with the shelf picture, its reply waiting for `wait` ms and then streaming `pieces`
 * pieces at `rate` a second (`ChatLoad`), in the text motion, picture motion and glow the query
 * names. After a warm-up that calibrates the refresh it measures each phase apart: the frames
 * shown, each frame's script in its animation-frame callbacks and, while streaming, the long
 * animation frames. A `listen` run first records 3 s through the box's push-to-talk in that
 * listening motion (Chrome's fake microphone), transcribes for 300 ms and lets the heard question
 * arrive for 1.5 s, measuring both, and decodes the recording. A `speak` run reads the reply aloud
 * as it streams, each complete sentence of `neatSpeakable` in turn at 55 ms a character with
 * a pretend voice's samples, and measures 3 s of the speech that remains after the reply. The result shows on
 * the page and as `window.benchChat` for the harness (`harness/chat-budget.mjs`). With `measure=0`
 * it asks again and again, for watching a variant.
 */
@Component({
  selector: 'bench-chat-host',
  imports: [NeatChatTranscript, NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat-host.css',
  template: `
    <div class="chat">
      <neat-chat-transcript
        [messages]="shownMessages()"
        [textMotion]="query.text"
        [pictureMotion]="query.picture"
        [listeningMotion]="listeningMotion"
        [speakingMotion]="speakingMotion"
      />
      <neat-message-box
        [activity]="activity()"
        [glow]="query.glow"
        [talk]="query.listen !== 'none'"
        [listeningMotion]="listeningMotion"
        [transcribing]="transcribing()"
        [(recording)]="recording"
        (recorded)="onRecorded($event)"
      />
    </div>
    <output class="chat-result">{{ result() }}</output>
  `,
})
export class ChatHost {
  protected readonly query = chatQuery(inject(ActivatedRoute).snapshot.queryParamMap);
  protected readonly listeningMotion: NeatListeningMotion =
    this.query.listen === 'none' ? 'in-message-box' : this.query.listen;
  protected readonly speakingMotion: NeatSpeakingMotion =
    this.query.speak === 'none' ? 'sentence' : this.query.speak;
  private readonly load = new ChatLoad(1, this.query);
  private readonly question =
    this.query.listen === 'none'
      ? QUESTION
      : ({ id: 'heard', role: 'user', text: HEARD_QUESTION, heard: true } as const);
  protected readonly messages = signal<readonly NeatChatMessage[]>(
    this.query.listen === 'none' ? [QUESTION] : [],
  );
  /** What read aloud says now, merged into the reply. */
  private readonly speech = signal<NeatSpeech | null>(null);
  protected readonly shownMessages = computed(() => {
    const speech = this.speech();
    return this.messages().map((message) =>
      speech && message.role === 'assistant' ? { ...message, speech } : message,
    );
  });
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');
  protected readonly recording = signal(false);
  protected readonly transcribing = signal(false);
  protected readonly result = signal(this.query.measure ? 'Measuring…' : 'Looping');
  private recordedResult: Promise<ChatRecorded> | null = null;

  constructor() {
    const measured = this.query.measure ? new Measurement() : null;
    const speaker = new Speaker((speech) => this.speech.set(speech));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let round = 0;
    const later = (ms: number, then: () => void) => (timer = setTimeout(then, ms));

    const begin = () => {
      if (measured && !measured.calibrate()) return void finish(null);
      if (this.query.listen === 'none') return ask();
      // Listening: the box records, transcribes, and the heard question arrives.
      measured?.open('listening');
      this.recording.set(true);
      later(LISTEN_MS, () => {
        this.recording.set(false);
        this.transcribing.set(true);
        later(TRANSCRIBE_MS, () => {
          this.transcribing.set(false);
          measured?.open('heard');
          this.messages.set([this.question]);
          later(HEARD_MS, ask);
        });
      });
    };
    const ask = () => {
      round++;
      const id = `reply-${round}`;
      speaker.reset();
      this.messages.set([this.question, { id, role: 'assistant', text: '', state: 'waiting' }]);
      this.activity.set('waiting');
      measured?.open('waiting');
      later(this.query.wait, () => stream(id, 0));
    };
    const stream = (id: string, shown: number) => {
      if (shown === 0) measured?.open('streaming');
      const next = shown + 1;
      const done = next === this.load.pieces.length;
      const text = this.load.textAt(next);
      this.messages.set([
        this.question,
        { id, role: 'assistant', text, state: done ? 'done' : 'streaming' },
      ]);
      this.activity.set(done ? 'idle' : 'streaming');
      if (this.query.speak !== 'none') speaker.update(text, done);
      if (!done) {
        later(this.load.intervals[next], () => stream(id, next));
        return;
      }
      if (this.query.speak !== 'none') {
        measured?.open('speaking');
        later(SPEAKING_MS, () => (measured ? finish(measured) : speaker.whenQuiet(again)));
        return;
      }
      if (measured) finish(measured);
      else again();
    };
    const again = () =>
      later(LOOP_PAUSE_MS, () => (this.query.listen === 'none' ? ask() : begin()));
    const finish = async (measurement: Measurement | null) => {
      const result = measurement?.end() ?? null;
      if (result === null) {
        this.result.set(NO_FRAMES);
        return;
      }
      const recorded = this.recordedResult ? await this.recordedResult : undefined;
      const whole = recorded ? { ...result, recorded } : result;
      window.benchChat = whole;
      this.result.set(describe(whole));
    };

    afterNextRender(() => {
      measured?.start();
      later(CHAT_WARMUP_MS, begin);
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      speaker.reset();
      measured?.stop();
    });
  }

  /** A recording made in the box: decoded in the page, for its length. */
  protected onRecorded(recording: Blob): void {
    this.recordedResult = decode(recording);
  }
}

/** A recording's size, type and decoded length. */
async function decode(recording: Blob): Promise<ChatRecorded> {
  let decodedMs = 0;
  try {
    const context = new AudioContext();
    decodedMs = (await context.decodeAudioData(await recording.arrayBuffer())).duration * 1000;
    void context.close();
  } catch {
    // Not decodable: its length stays 0, and the run fails on it.
  }
  return { bytes: recording.size, type: recording.type, decodedMs };
}

/** The strip's bars a pretend voice's loudness follows. */
const VOICE_BARS = 90;

/**
 * A pretend voice for sentence `k`, `ms` long: a 220 Hz tone whose loudness follows the moments
 * mockup's waveform (its strip's `shape`), so the waveform motion's strip has a voice to draw.
 */
function voiceSamples(k: number, ms: number): Float32Array {
  const random = mulberry32(k + 1);
  const shape = Array.from({ length: VOICE_BARS }, (_, i) =>
    Math.max(0.05, Math.abs(Math.sin(i * 0.35) * Math.sin(i * 0.11 + k)) * (0.5 + random() * 0.5)),
  );
  const samples = new Float32Array(Math.round((ms / 1000) * VOICE_RATE));
  for (let j = 0; j < samples.length; j++) {
    const bar = Math.min(VOICE_BARS - 1, Math.floor((j / samples.length) * VOICE_BARS));
    samples[j] = shape[bar] * Math.sin((2 * Math.PI * 220 * j) / VOICE_RATE);
  }
  return samples;
}

/**
 * Read aloud as an app does it: each complete sentence of the growing reply, in order, said for
 * 55 ms a character with a pretend voice's samples, the sentence being said given to `say`.
 */
class Speaker {
  private spokenTo = 0;
  /** How many sentences were queued, each a voice of its own. */
  private said = 0;
  private queue: { readonly speech: NeatSpeech; readonly ms: number }[] = [];
  private playing = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private quiet: (() => void) | null = null;

  constructor(private readonly say: (speech: NeatSpeech | null) => void) {}

  /** The reply's text now: its new complete sentences join the queue. */
  update(text: string, final: boolean): void {
    for (const sentence of neatSpeakable(text, { final })) {
      if (!sentence.complete || sentence.from < this.spokenTo) continue;
      const ms = sentence.text.length * MS_PER_CHARACTER;
      this.queue.push({
        speech: {
          from: sentence.from,
          to: sentence.to,
          startedAt: 0,
          audio: { samples: voiceSamples(this.said++, ms), sampleRate: VOICE_RATE },
        },
        ms,
      });
      this.spokenTo = sentence.to;
    }
    if (!this.playing) this.next();
  }

  /** Calls `then` once nothing is left to say. */
  whenQuiet(then: () => void): void {
    if (!this.playing) then();
    else this.quiet = then;
  }

  reset(): void {
    clearTimeout(this.timer);
    this.said = 0;
    this.queue = [];
    this.playing = false;
    this.spokenTo = 0;
    this.quiet = null;
    this.say(null);
  }

  private next(): void {
    const next = this.queue.shift();
    if (!next) {
      this.playing = false;
      this.say(null);
      const quiet = this.quiet;
      this.quiet = null;
      quiet?.();
      return;
    }
    this.playing = true;
    this.say({ ...next.speech, startedAt: performance.now() });
    this.timer = setTimeout(() => this.next(), next.ms);
  }
}

/**
 * The page's measuring: the frame recorder from the start (the warm-up calibrates the refresh),
 * then a mark where each phase opens, which closes the one before; the callback timer and the long
 * frames are reset at each phase's start.
 */
class Measurement {
  private lastFrameMs = 0;
  private readonly recorder = new FrameRecorder({
    capacity: 16384,
    onFrame: (timeMs) => (this.lastFrameMs = timeMs),
  });
  private readonly timer = new CallbackTimer(window);
  private readonly loafs = new LoafCollector();
  private refresh: Refresh | null = null;
  private current: { name: PhaseName; from: number; fromMs: number } | null = null;
  private readonly results = new Map<PhaseName, ChatPhaseResult>();
  private streamLoafs: LoafSummary | null = null;

  start(): void {
    this.timer.install();
    this.recorder.start();
    this.loafs.start();
  }

  /** The warm-up ends: the refresh is calibrated on it; false when too few frames came. */
  calibrate(): boolean {
    try {
      this.refresh = calibrateRefresh(this.recorder.between(0, this.recorder.mark()));
      return true;
    } catch {
      // No frames, or too few to calibrate on: a hidden tab, or a browser without a display.
      this.refresh = null;
      return false;
    }
  }

  /** A phase begins, and the one before it ends. */
  open(name: PhaseName): void {
    if (!this.refresh) return;
    this.close();
    this.current = { name, from: this.recorder.mark(), fromMs: this.lastFrameMs };
    this.timer.reset();
    this.loafs.reset();
  }

  /** The run is done: the result, or null when too few frames came to measure by. */
  end(): ChatBenchResult | null {
    const refresh = this.refresh;
    this.close();
    this.stop();
    const waiting = this.results.get('waiting');
    const streaming = this.results.get('streaming');
    if (!refresh || !waiting || !streaming || !this.streamLoafs) return null;
    const optional = (name: PhaseName) => {
      const phase = this.results.get(name);
      return phase ? { [name]: phase } : {};
    };
    return {
      hz: refresh.hz,
      ...optional('listening'),
      ...optional('heard'),
      waiting,
      streaming: { ...streaming, loafs: this.streamLoafs },
      ...optional('speaking'),
    };
  }

  stop(): void {
    this.recorder.stop();
    this.timer.uninstall();
    this.loafs.stop();
  }

  private close(): void {
    const current = this.current;
    const refresh = this.refresh;
    if (!current || !refresh) return;
    this.current = null;
    this.results.set(current.name, this.phase(current.from, refresh));
    if (current.name === 'streaming') {
      this.streamLoafs = this.loafs.summarize(
        current.fromMs,
        this.lastFrameMs + refresh.intervalMs,
      );
    }
  }

  private phase(from: number, refresh: Refresh): ChatPhaseResult {
    const frames = this.recorder.between(from, this.recorder.mark());
    const stats = frameStats(frames.deltas, frames.windowMs, refresh.intervalMs);
    const script = Float64Array.from(this.timer.results()).sort();
    return {
      frames: stats,
      tier: tierOf(stats, refresh.intervalMs),
      script: script.length
        ? {
            p50: percentile(script, 50),
            p95: percentile(script, 95),
            worst: script[script.length - 1],
          }
        : { p50: 0, p95: 0, worst: 0 },
    };
  }
}

/** The page's variants and load from its query; a value it does not know is the default. */
export function chatQuery(query: { get(name: string): string | null }): ChatQuery {
  const oneOf = <T extends string>(name: string, values: readonly T[], fallback: T): T => {
    const value = query.get(name);
    return values.includes(value as T) ? (value as T) : fallback;
  };
  const count = (name: string, fallback: number): number => {
    const value = Number(query.get(name) ?? Number.NaN);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  return {
    text: oneOf('text', NEAT_TEXT_MOTIONS, 'plain'),
    picture: oneOf('picture', NEAT_PICTURE_MOTIONS, 'coming-into-focus'),
    glow: oneOf('glow', [...NEAT_MESSAGE_BOX_GLOWS, 'none'], 'comet'),
    rate: count('rate', 50),
    wait: count('wait', 1300),
    pieces: count('pieces', 500),
    reply: oneOf('reply', ['prose', 'code', 'mockup'] as const, 'prose'),
    listen: oneOf('listen', [...NEAT_LISTENING_MOTIONS, 'none'], 'none'),
    speak: oneOf('speak', [...NEAT_SPEAKING_MOTIONS, 'none'], 'none'),
    measure: query.get('measure') !== '0',
  };
}

/** The result in a line: each phase's frames and tier, and the recording. */
function describe(result: ChatBenchResult): string {
  const phase = (name: string, { frames, tier, script }: ChatPhaseResult) =>
    `${name}: ${frames.fps.toFixed(1)} fps, p95 ${frames.p95.toFixed(1)} ms, ` +
    `${frames.droppedPct.toFixed(1)} % dropped, script p95 ${script.p95.toFixed(1)} ms, ${tier}`;
  const phases = (['listening', 'heard', 'waiting', 'streaming', 'speaking'] as const)
    .filter((name) => result[name])
    .map((name) => phase(name, result[name]!));
  const recorded = result.recorded
    ? [`recorded ${result.recorded.bytes} bytes, ${Math.round(result.recorded.decodedMs)} ms`]
    : [];
  return [`${result.hz} Hz`, ...phases, ...recorded].join(' · ');
}
