import { mulberry32, type Prng, shuffled } from './prng';

/*
 * The synthetic messages the dots stand for (design 2.2), delivered in 100 ms batches as the
 * gateway delivers real ones: no timer per message, the same push path the real feed takes, and
 * exact long-run rates. The feed counts batches, not wall time: batch k always holds the messages
 * of [k × 100 ms, (k + 1) × 100 ms) of feed time, so the same seed pushes the same sequence on
 * every machine however late its timer fires. A driver that falls behind calls `next` as often as
 * it has to and adds its own start time to `atMs`. Runs outside Angular and writes no signals.
 */

/** How a step's total rate is spread over the edges. */
export type RateProfile = 'uniform' | 'demo-like';

/** What an edge carries, after the Autoware demo: camera frames or detection results. */
export type EdgeKind = 'frames' | 'results';

export interface FeedParams {
  /** The edges that carry messages, in the diagram's order. */
  readonly edges: readonly string[];
  /** Messages per second over all the edges. */
  readonly msgsPerSec: number;
  readonly profile: RateProfile;
  readonly seed: number;
}

/** What an edge is given to carry. */
export interface EdgeLoad {
  readonly edge: string;
  readonly kind: EdgeKind;
  /** Messages per second. */
  readonly rate: number;
  /** A message's size before its jitter, in bytes. */
  readonly bytes: number;
}

/** Where messages go: the dot layer's `push(edgeId, bytes, atMs)`, through the driver. */
export type MessageSink = (edgeId: string, bytes: number, atMs: number) => void;

export const BATCH_MS = 100;
/** The demo's camera frame, about 1.2 MB, and its detection result, about 2 KB. */
export const FRAME_BYTES = 1_200_000;
export const RESULT_BYTES = 2_000;
/** Each message's size varies by up to this share either way. */
const JITTER = 0.1;
/** In the demo-like profile a fifth of the edges carry four fifths of the messages. */
const FRAME_EDGE_SHARE = 0.2;
const FRAME_MESSAGE_SHARE = 0.8;

export class MessageFeed {
  readonly loads: readonly EdgeLoad[];
  /**
   * Each edge's offset into its message period, in [0, 1): message m on an edge leaves at
   * (m + offset) ÷ rate seconds, so edges of one rate do not all leave at once.
   */
  private readonly offsets: readonly number[];
  /** Draws the sizes' jitter, after the edges' kinds and offsets, in push order. */
  private readonly rand: Prng;
  private batch = 0;

  constructor({ edges, msgsPerSec, profile, seed }: FeedParams) {
    if (!(msgsPerSec >= 0) || !Number.isFinite(msgsPerSec)) {
      throw new RangeError(`a feed's rate is a number of messages per second, not ${msgsPerSec}`);
    }
    if (edges.length === 0 && msgsPerSec > 0) {
      throw new RangeError(`${msgsPerSec} messages per second need an edge to carry them`);
    }
    this.rand = mulberry32(seed);
    // The camera-like edges are the same ones in both profiles, so switching the profile changes
    // the rates only.
    const frameCount = edges.length && Math.max(1, Math.round(edges.length * FRAME_EDGE_SHARE));
    const frameEdges = new Set(shuffled(this.rand, edges).slice(0, frameCount));
    const skewed = profile === 'demo-like' && frameCount < edges.length;
    const uniform = msgsPerSec / edges.length;
    const frameRate = skewed ? (msgsPerSec * FRAME_MESSAGE_SHARE) / frameCount : uniform;
    const resultRate = skewed
      ? (msgsPerSec * (1 - FRAME_MESSAGE_SHARE)) / (edges.length - frameCount)
      : uniform;
    this.loads = edges.map((edge) => {
      const kind: EdgeKind = frameEdges.has(edge) ? 'frames' : 'results';
      return kind === 'frames'
        ? { edge, kind, rate: frameRate, bytes: FRAME_BYTES }
        : { edge, kind, rate: resultRate, bytes: RESULT_BYTES };
    });
    this.offsets = edges.map(() => this.rand());
  }

  /** Pushes the next batch's messages into `sink`, edge by edge, and returns how many. */
  next(sink: MessageSink): number {
    const from = (this.batch * BATCH_MS) / 1000;
    const to = ((this.batch + 1) * BATCH_MS) / 1000;
    this.batch++;
    let pushed = 0;
    this.loads.forEach(({ edge, rate, bytes }, i) => {
      const offset = this.offsets[i];
      // The messages m whose time (m + offset) ÷ rate falls in [from, to).
      const end = Math.ceil(rate * to - offset);
      for (let m = Math.ceil(rate * from - offset); m < end; m++) {
        const size = Math.round(bytes * (1 + JITTER * (2 * this.rand() - 1)));
        sink(edge, size, ((m + offset) * 1000) / rate);
        pushed++;
      }
    });
    return pushed;
  }
}
