import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NEAT_MESSAGE_BOX_GLOWS,
  NEAT_PICTURE_MOTIONS,
  NeatChatTranscript,
  NeatMessageBox,
  type NeatChatMessage,
  type NeatMessageBoxActivity,
  type NeatMessageBoxGlow,
  type NeatPictureMotion,
} from '@sima/neat-ui/chat';
import { NEAT_TEXT_MOTIONS, type NeatTextMotion } from '@sima/neat-ui/markdown';
import { CallbackTimer } from '../measure/callback-timer';
import { calibrateRefresh, FrameRecorder, type Refresh } from '../measure/frame-recorder';
import { LoafCollector, type LoafSummary } from '../measure/loaf-collector';
import { type FrameStats, frameStats, percentile, type Tier, tierOf } from '../measure/stats';
import { type ChatReply, ChatLoad } from '../synth/chat-load';
import { NO_FRAMES } from './bev-host';

/** How long the page settles (and calibrates the refresh) before the reply waits. */
export const CHAT_WARMUP_MS = 2000;
/** How long a looping page (`measure=0`) rests after a reply before it asks again. */
const LOOP_PAUSE_MS = 2000;

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

/** What the chat page's measurement found, as the page shows it and `benchChat` holds it. */
export interface ChatBenchResult {
  readonly hz: number;
  /** While the reply waits: the orb and clock, the glow, the picture's reading. */
  readonly waiting: ChatPhaseResult;
  /** While the reply streams in its text motion, with the long frames that came. */
  readonly streaming: ChatPhaseResult & { readonly loafs: LoafSummary };
}

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
 * names. After a warm-up that calibrates the refresh it measures the waiting phase and the
 * streaming phase apart: the frames shown, each frame's script in its animation-frame callbacks
 * and, while streaming, the long animation frames. The result shows on the page and as
 * `window.benchChat` for the harness (`harness/chat-budget.mjs`). With `measure=0` it asks again
 * and again, for watching a variant.
 */
@Component({
  selector: 'bench-chat-host',
  imports: [NeatChatTranscript, NeatMessageBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './chat-host.css',
  template: `
    <div class="chat">
      <neat-chat-transcript
        [messages]="messages()"
        [textMotion]="query.text"
        [pictureMotion]="query.picture"
      />
      <neat-message-box [activity]="activity()" [glow]="query.glow" />
    </div>
    <output class="chat-result">{{ result() }}</output>
  `,
})
export class ChatHost {
  protected readonly query = chatQuery(inject(ActivatedRoute).snapshot.queryParamMap);
  private readonly load = new ChatLoad(1, this.query);
  protected readonly messages = signal<readonly NeatChatMessage[]>([QUESTION]);
  protected readonly activity = signal<NeatMessageBoxActivity>('idle');
  protected readonly result = signal(this.query.measure ? 'Measuring…' : 'Looping');

  constructor() {
    const measured = this.query.measure ? new Measurement() : null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let round = 0;
    const later = (ms: number, then: () => void) => (timer = setTimeout(then, ms));

    const ask = () => {
      round++;
      const id = `reply-${round}`;
      this.messages.set([QUESTION, { id, role: 'assistant', text: '', state: 'waiting' }]);
      this.activity.set('waiting');
      measured?.begin();
      later(this.query.wait, () => stream(id, 0));
    };
    const stream = (id: string, shown: number) => {
      if (shown === 0) measured?.firstWord();
      const next = shown + 1;
      const done = next === this.load.pieces.length;
      this.messages.set([
        QUESTION,
        { id, role: 'assistant', text: this.load.textAt(next), state: done ? 'done' : 'streaming' },
      ]);
      this.activity.set(done ? 'idle' : 'streaming');
      if (!done) {
        later(this.load.intervals[next], () => stream(id, next));
        return;
      }
      if (measured) {
        const result = measured.end();
        if (result === null) {
          this.result.set(NO_FRAMES);
          return;
        }
        window.benchChat = result;
        this.result.set(describe(result));
        return;
      }
      later(LOOP_PAUSE_MS, ask);
    };

    afterNextRender(() => {
      measured?.start();
      later(CHAT_WARMUP_MS, ask);
    });
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(timer);
      measured?.stop();
    });
  }
}

/**
 * The page's measuring: the frame recorder from the start (the warm-up calibrates the refresh),
 * then a mark where the reply begins to wait, one at its first word and one at its last piece;
 * the callback timer and the long frames are reset at each phase's start.
 */
class Measurement {
  private lastFrameMs = 0;
  private readonly recorder = new FrameRecorder({
    capacity: 8192,
    onFrame: (timeMs) => (this.lastFrameMs = timeMs),
  });
  private readonly timer = new CallbackTimer(window);
  private readonly loafs = new LoafCollector();
  private refresh: Refresh | null = null;
  private waitFrom = 0;
  private streamFrom = 0;
  private streamFromMs = 0;
  private waiting: ChatPhaseResult | null = null;

  start(): void {
    this.timer.install();
    this.recorder.start();
    this.loafs.start();
  }

  /** The reply begins to wait: the warm-up ends, and the refresh is calibrated on it. */
  begin(): void {
    try {
      this.refresh = calibrateRefresh(this.recorder.between(0, this.recorder.mark()));
    } catch {
      // No frames, or too few to calibrate on: a hidden tab, or a browser without a display.
      this.refresh = null;
      return;
    }
    this.waitFrom = this.recorder.mark();
    this.timer.reset();
  }

  firstWord(): void {
    if (!this.refresh) return;
    this.waiting = this.phase(this.waitFrom, this.refresh);
    this.streamFrom = this.recorder.mark();
    this.streamFromMs = this.lastFrameMs;
    this.timer.reset();
    this.loafs.reset();
  }

  /** The reply is done: the result, or null when too few frames came to measure by. */
  end(): ChatBenchResult | null {
    const refresh = this.refresh;
    const waiting = this.waiting;
    if (!refresh || !waiting) {
      this.stop();
      return null;
    }
    const streaming = this.phase(this.streamFrom, refresh);
    const loafs = this.loafs.summarize(this.streamFromMs, this.lastFrameMs + refresh.intervalMs);
    this.stop();
    return { hz: refresh.hz, waiting, streaming: { ...streaming, loafs } };
  }

  stop(): void {
    this.recorder.stop();
    this.timer.uninstall();
    this.loafs.stop();
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
    reply: oneOf('reply', ['prose', 'code'] as const, 'prose'),
    measure: query.get('measure') !== '0',
  };
}

/** The result in a line: each phase's frames and tier. */
function describe({ hz, waiting, streaming }: ChatBenchResult): string {
  const phase = (name: string, { frames, tier, script }: ChatPhaseResult) =>
    `${name}: ${frames.fps.toFixed(1)} fps, p95 ${frames.p95.toFixed(1)} ms, ` +
    `${frames.droppedPct.toFixed(1)} % dropped, script p95 ${script.p95.toFixed(1)} ms, ${tier}`;
  return `${hz} Hz · ${phase('waiting', waiting)} · ${phase('streaming', streaming)}`;
}
