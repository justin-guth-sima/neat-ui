import type { NeatDiagramEdge } from '../model';

/*
 * The messaging layer's dots as numbers, without drawing: when each dot starts, how far along its
 * edge it is (0 at the start, 1 at the end) and how large it is. Pure, so its timing is tested
 * without a browser; the layer draws what `advance` returns. Ported from the Autoware demo's
 * System page, its numbers kept.
 *
 * Times are in ms on one clock of the caller's (the layer uses `performance.now()`).
 */

/**
 * How long a dot takes along an edge without a time of its own (`DotModel.travelMs`). Edges with a
 * length take length / speed (`travelTime`), so every dot moves at the same speed: the real
 * latency is a number, not the motion.
 */
export const TRAVEL_MS = 1200;

/**
 * The shortest and longest time a dot takes along an edge: a tiny edge's dot stays visible long
 * enough to see; the longest is only a guard and must stay above every edge's length / speed, or
 * long edges run faster than the rest (the demo's 3 s cap made its widest edges 1.5x too fast).
 */
export const MIN_TRAVEL_MS = 120;
export const MAX_TRAVEL_MS = 20000;

/** How long a dot takes along an edge of `length` (diagram units) at `speed` (units per second). */
export function travelTime(length: number, speed: number): number {
  if (!(speed > 0) || !Number.isFinite(length)) return TRAVEL_MS;
  return Math.min(MAX_TRAVEL_MS, Math.max(MIN_TRAVEL_MS, (length / speed) * 1000));
}

/** A dot's radius by its message's size: 2 up to 1 kB, +1.5 per tenfold, at most 7. */
export function dotRadius(bytes: number): number {
  const r = 2 + 1.5 * Math.log10(Math.max(bytes, 1) / 1000);
  return Math.min(7, Math.max(2, r));
}

/** A dot on its way this frame. The objects are the model's own and reused: read, do not keep. */
export interface Dot {
  edge: string;
  /** How far along its edge, 0 to 1. */
  t: number;
  /** Its radius in diagram units. */
  r: number;
  /**
   * The caller's color, passed on to the step dots it starts: a whole number from 0 to 255, since
   * the pool keeps it in a byte (the layer's series 1 to 8 fit).
   */
  color: number;
}

/** Told every dot spawned (step dots too), with the time it starts and its message's bytes. */
export type SpawnListener = (edge: string, atMs: number, bytes: number) => void;

/**
 * How many dots the model holds, on their way and waiting to start. A drill-down at 4 s travel
 * holds about 72 msg/s · 4 s · (1 + 2 + … + 6) ≈ 6000 (each step's dot waits for those before
 * it); the cap is what keeps a burst (thousands of pushes in one tick) from growing memory.
 */
export const MAX_DOTS = 16384;

/**
 * How many dots one message may place, itself and its step dots together: a guard against steps
 * that loop, and against steps that fan out and loop, whose placements grow with every round. A
 * chain of the demo's size (six steps) is far inside it.
 */
export const MAX_CHAIN = 32;

/**
 * A fixed pool of dots. `spawn` places a dot that starts at `atMs` (now, or soon: a batch spreads
 * its messages, see `neatBatchTimes`), `advance` gives the dots on their way at a time and forgets
 * those that arrived. A full pool drops its oldest dot and counts it in `dropped`: the newest
 * messages are the ones worth showing, and the listener still hears every spawn, so the rates
 * stay exact however many dots are dropped.
 *
 * The pool is a ring in placement order, so dropping the oldest is one step, not a shift of every
 * dot.
 *
 * Step dots (`setChain`): a dot on an edge that leads into a node's steps starts a dot on each
 * following step once it has arrived and that step's time has passed, and so on along the chain,
 * so the dots inside a node follow the real input's rhythm and the measured stage times. They are
 * placed at once, with their later start times, from the stage times of that moment.
 */
export class DotModel {
  private readonly edges: string[];
  private readonly starts: Float64Array;
  private readonly radii: Float32Array;
  private readonly colors: Uint8Array;
  private readonly shown: Uint8Array;
  private readonly out: Dot[] = [];
  private readonly frame: Dot[] = [];
  /** Where the oldest dot is in the ring. */
  private head = 0;
  private count = 0;
  /** How many of those are `shown` (placed with `visible`). */
  private shownCount = 0;
  /** What the message being placed may still place, step dots included. */
  private budget = 0;
  private next: ReadonlyMap<string, readonly string[]> = new Map();
  private delayOf: (edge: string) => number = () => 0;
  private travel: ReadonlyMap<string, number> = new Map();

  /** Dots dropped, the oldest first, because the pool was full. */
  dropped = 0;
  /** Dots placed with `visible`, step dots included. */
  spawned = 0;
  /** How long a dot takes along an edge without an entry in `setTravel`. */
  travelMs = TRAVEL_MS;

  constructor(
    readonly capacity = MAX_DOTS,
    private readonly onSpawn?: SpawnListener,
  ) {
    this.edges = new Array<string>(capacity).fill('');
    this.starts = new Float64Array(capacity);
    this.radii = new Float32Array(capacity);
    this.colors = new Uint8Array(capacity);
    this.shown = new Uint8Array(capacity);
  }

  /** Dots placed and not yet arrived, those still to start included. */
  get size(): number {
    return this.count;
  }

  /**
   * Dots placed with `visible` and not yet arrived, those still to start included: what a frame
   * is for. Dots placed hidden (`DotEvery`) are in `size` and not here.
   */
  get visibleSize(): number {
    return this.shownCount;
  }

  /**
   * The step dots: `next` maps an edge id to the steps that follow it (`chainOf`), `delayMs` gives
   * a step's stage time, read when the dot before it is spawned.
   */
  setChain(next: ReadonlyMap<string, readonly string[]>, delayMs: (edge: string) => number): void {
    this.next = next;
    this.delayOf = delayMs;
  }

  /** Each edge's travel time (ms, by edge id); applies to the dots on their way too. */
  setTravel(travel: ReadonlyMap<string, number>): void {
    this.travel = travel;
  }

  /**
   * A message on `edge` that starts at `atMs`. A message whose time is not a finite number gets
   * no dot and is not told to the listener: it could never arrive, so it would hold a slot until
   * the pool dropped it, and no rate window holds it. With `visible` false (a message that gets
   * no dot, see `DotEvery`) it is placed all the same, with its step dots, so the listener counts
   * it, but `advance` does not return it.
   */
  spawn(edge: string, atMs: number, bytes: number, color = 0, visible = true): void {
    this.budget = MAX_CHAIN;
    this.place(edge, atMs, dotRadius(bytes), color, bytes, visible);
  }

  /**
   * The dots on their way at `nowMs`, in the order they were placed (on one edge, the order they
   * started: the first is the furthest along); arrived ones are forgotten. Allocates nothing: the
   * array and its dots are the model's own, rewritten on the next call.
   */
  advance(nowMs: number): readonly Dot[] {
    const frame = this.frame;
    // Writing by index and trimming once at the end, not `length = 0` and `push`: emptying an
    // array drops its backing store in V8, so every frame would grow it again.
    let n = 0;
    // One pass: the dots still to come move down over the arrived ones, keeping their order.
    let kept = 0;
    for (let k = 0; k < this.count; k++) {
      const i = this.slot(k);
      const t = (nowMs - this.starts[i]) / this.travelOf(this.edges[i]);
      // Arrived, or never will (a travel time that is not a number): either way, forgotten.
      if (!(t < 1)) {
        this.shownCount -= this.shown[i];
        continue;
      }
      const to = this.slot(kept);
      if (to !== i) {
        this.edges[to] = this.edges[i];
        this.starts[to] = this.starts[i];
        this.radii[to] = this.radii[i];
        this.colors[to] = this.colors[i];
        this.shown[to] = this.shown[i];
      }
      if (t >= 0 && this.shown[to]) {
        const dot = this.dotAt(n);
        dot.edge = this.edges[to];
        dot.t = t;
        dot.r = this.radii[to];
        dot.color = this.colors[to];
        frame[n++] = dot;
      }
      kept++;
    }
    this.count = kept;
    if (frame.length !== n) frame.length = n;
    return frame;
  }

  clear(): void {
    this.count = 0;
    this.shownCount = 0;
    this.head = 0;
  }

  /** The ring position of the `k`th oldest dot. */
  private slot(k: number): number {
    const i = this.head + k;
    return i < this.capacity ? i : i - this.capacity;
  }

  /** The `n`th reused dot object, made the first time a frame holds that many. */
  private dotAt(n: number): Dot {
    if (n === this.out.length) this.out.push({ edge: '', t: 0, r: 0, color: 0 });
    return this.out[n];
  }

  private travelOf(edge: string): number {
    return this.travel.get(edge) ?? this.travelMs;
  }

  private place(
    edge: string,
    atMs: number,
    r: number,
    color: number,
    bytes: number,
    visible: boolean,
  ): void {
    // A step's start is its input's plus times (travel, stage) that could be non-finite too.
    if (!Number.isFinite(atMs) || this.budget === 0) return;
    this.budget--;
    if (this.count === this.capacity) {
      this.shownCount -= this.shown[this.head];
      this.head = this.slot(1);
      this.count--;
      this.dropped++;
    }
    const i = this.slot(this.count++);
    this.edges[i] = edge;
    this.starts[i] = atMs;
    this.radii[i] = r;
    this.colors[i] = color;
    this.shown[i] = visible ? 1 : 0;
    if (visible) {
      this.spawned++;
      this.shownCount++;
    }
    this.onSpawn?.(edge, atMs, bytes);
    const following = this.next.get(edge);
    if (!following) return;
    const arrival = atMs + this.travelOf(edge);
    for (const step of following) {
      const delay = this.delayOf(step);
      const start = arrival + (Number.isFinite(delay) ? delay : 0);
      this.place(step, start, r, color, bytes, visible);
    }
  }
}

/**
 * An edge drawn inside a block's drill-down, whose dots no message feeds.
 *
 * Its dots follow the dots that enter the step's `from` side, timed by a measured stage. The
 * layer's `steps` input maps an edge id to one of these.
 */
export interface NeatDiagramMessageStep {
  /** The node whose stage times this step (the id the app passes to `stageMs`). */
  readonly from: string;
  /** The stage of `from` whose time a dot waits before it starts along this step. */
  readonly stage: string;
  /**
   * How many steps share the stage's time, each taking an even part, when one measured stage spans
   * several steps one after another. Unset: this step takes the whole stage.
   */
  readonly shares?: number;
}

/**
 * Which steps follow each edge, by edge id: an edge (fed or a step) is followed by the steps that
 * leave the node it enters. Edges that lead to no step are not in the
 * map; a step whose id is not among `edges` (a stale config) is not followed.
 */
export function chainOf(
  edges: readonly Pick<NeatDiagramEdge, 'id' | 'from' | 'to'>[],
  steps: Readonly<Record<string, NeatDiagramMessageStep>>,
): Map<string, string[]> {
  const leaving = new Map<string, string[]>();
  for (const edge of edges) {
    if (!Object.hasOwn(steps, edge.id)) continue;
    const from = leaving.get(edge.from);
    if (from) from.push(edge.id);
    else leaving.set(edge.from, [edge.id]);
  }
  const next = new Map<string, string[]>();
  for (const edge of edges) {
    const following = leaving.get(edge.to);
    if (following) next.set(edge.id, following);
  }
  return next;
}

/**
 * The most a batch may spread its messages over. A batch is messages the app received together
 * that happened over a short time (the demo's gateway sent one every 50 ms); a stalled source's
 * batch spreads no wider than this, so its dots do not trail behind for seconds.
 */
export const BATCH_SPREAD_MS = 200;

/**
 * The start times of a batch's messages, for an app whose transport delivers messages in batches.
 *
 * Pass each time as the `atMs` of its `push`, with `performance.now()` as the arrival:
 *
 * ```ts
 * const at = neatBatchTimes(batch.map((m) => m.sourceMs), performance.now());
 * batch.forEach((m, i) => messages.push(m.edge, m.bytes, at[i]));
 * ```
 *
 * The earliest message starts at the batch's arrival (`arrivalMs`). The others start after it, as
 * far apart as their own times (`offsetsMs`, on any clock in ms) say, at most 200 ms. A message
 * without a finite time of its own starts at the arrival.
 */
export function neatBatchTimes(offsetsMs: readonly number[], arrivalMs: number): number[] {
  let first = Infinity;
  for (const ms of offsetsMs) if (ms < first) first = ms;
  return offsetsMs.map((ms) =>
    Number.isFinite(ms) ? arrivalMs + Math.min(BATCH_SPREAD_MS, ms - first) : arrivalMs,
  );
}

/**
 * Which messages get a dot ("messages per dot", N): on each edge, every Nth message does, counted
 * per edge, so it is deterministic and one busy edge does not decide for the others. The first
 * message after a start or a change of N gets one, so a quiet edge shows a dot at once. The
 * messages in between still count in the rates (`DotModel.spawn` with `visible` false).
 */
export class DotEvery {
  private every = 1;
  private readonly seen = new Map<string, number>();

  /** Sets N (a whole number, at least 1); a change starts every edge's count again. */
  set(n: number): void {
    const every = Math.max(1, Math.round(n) || 1);
    if (every === this.every) return;
    this.every = every;
    this.seen.clear();
  }

  /** Counts a message on `edge`; true when it gets a dot. */
  take(edge: string): boolean {
    if (this.every === 1) return true;
    const n = this.seen.get(edge) ?? 0;
    this.seen.set(edge, n + 1 === this.every ? 0 : n + 1);
    return n === 0;
  }
}
