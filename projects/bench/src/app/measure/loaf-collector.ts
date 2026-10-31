/*
 * Long animation frames (design 1.2): what explains a spike the frame times only show. The browser
 * reports a frame of 50 ms or more with the scripts that ran in it, so a hitch can be told apart
 * as the dot layer, d3-zoom, the message feed's timer or style and layout after a step change. It
 * sees spikes only: the steady 17 to 50 ms frames of a slow board never reach it. A raw-browser-API
 * unit like the recorder (AGENTS.md), with the observer injected for the specs; it keeps the few
 * entries a run produces and works them out per phase, at the phase's end.
 */

/** A script a long animation frame ran, as the browser reports it (the fields used here). */
export interface LoafScript {
  readonly invoker: string;
  readonly invokerType: string;
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
  readonly sourceCharPosition: number;
  readonly duration: number;
  readonly forcedStyleAndLayoutDuration: number;
}

/** A `long-animation-frame` entry (not in the DOM typings yet): the fields used here. */
export interface LoafEntry {
  readonly startTime: number;
  readonly duration: number;
  readonly blockingDuration: number;
  readonly renderStart: number;
  /** Zero where the frame did no style and layout of its own. */
  readonly styleAndLayoutStart: number;
  readonly scripts: readonly LoafScript[];
}

/** What `PerformanceObserver` is to the collector; the specs fake it. */
export interface ObserverLike {
  observe(options: { type: string; buffered?: boolean }): void;
  disconnect(): void;
  takeRecords(): readonly unknown[];
}
export interface ObserverConstructor {
  new (callback: (list: { getEntries(): readonly unknown[] }) => void): ObserverLike;
  readonly supportedEntryTypes: readonly string[];
}

/** Which entries the browser could give: the result says, so numbers are read as what they are. */
export type LoafSource = 'long-animation-frame' | 'longtask' | 'none';

/** One script's total over a window. */
export interface LoafScriptSummary {
  readonly invoker: string;
  readonly invokerType: string;
  readonly sourceURL: string;
  readonly sourceFunctionName: string;
  readonly sourceCharPosition: number;
  readonly count: number;
  readonly durationMs: number;
  readonly forcedStyleAndLayoutMs: number;
}

/**
 * A window's long frames. Where the source cannot tell (long tasks have a duration and nothing
 * else), the field is null and not zero, so "none" is never mistaken for "measured and nothing".
 */
export interface LoafSummary {
  readonly source: LoafSource;
  readonly frames: number;
  readonly totalMs: number;
  readonly largestMs: number;
  readonly blockingTotalMs: number | null;
  readonly blockingLargestMs: number | null;
  /** Σ of the scripts' durations. */
  readonly scriptMs: number | null;
  /** Σ of what came after `styleAndLayoutStart`, to the frame's end. */
  readonly styleLayoutMs: number | null;
  /** `styleLayoutMs` ÷ (`styleLayoutMs` + `scriptMs`); null with neither. */
  readonly styleLayoutShare: number | null;
  /** The five scripts with the most summed duration, most first. */
  readonly scripts: readonly LoafScriptSummary[];
}

/** A soak of a few minutes with a spike every few seconds stays far below it. */
const DEFAULT_MAX_ENTRIES = 4096;
const TOP_SCRIPTS = 5;

/** The page's PerformanceObserver, or none where the browser has no such thing. */
const pageObserver = (): ObserverConstructor | undefined =>
  typeof PerformanceObserver === 'undefined'
    ? undefined
    : (PerformanceObserver as unknown as ObserverConstructor);

export class LoafCollector {
  /** What the browser offers; `source` says "none" instead once observing it has failed. */
  private readonly offered: LoafSource;
  private refused = false;
  private observer: ObserverLike | null = null;
  private entries: unknown[] = [];
  private dropped = 0;

  /** `Observer` is the page's by default; pass `undefined` to say there is none. */
  constructor(
    private readonly Observer: ObserverConstructor | undefined = pageObserver(),
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
  ) {
    const supported = Observer?.supportedEntryTypes ?? [];
    this.offered = supported.includes('long-animation-frame')
      ? 'long-animation-frame'
      : supported.includes('longtask')
        ? 'longtask'
        : 'none';
  }

  /** The entries this run has: what was offered, or none once the browser refused to observe. */
  get source(): LoafSource {
    return this.refused ? 'none' : this.offered;
  }

  /** Entries let go because `maxEntries` were held: a window's counts are then a lower bound. */
  get lost(): number {
    return this.dropped;
  }

  start(): void {
    if (this.offered === 'none' || this.observer || !this.Observer) return;
    const observer = new this.Observer((list) => this.keep(list.getEntries()));
    try {
      observer.observe({ type: this.offered });
    } catch {
      // A browser may list a type and still refuse it: the run then has no long frames, which the
      // result says ("none"), and measures on.
      this.refused = true;
      return;
    }
    this.observer = observer;
  }

  stop(): void {
    this.drain();
    this.observer?.disconnect();
    this.observer = null;
  }

  /** Forgets the entries kept so far, keeps observing. */
  reset(): void {
    this.drain();
    this.entries = [];
    this.dropped = 0;
  }

  /** The long frames that started in `[fromMs, toMs)`, on the clock rAF timestamps use. */
  summarize(fromMs: number, toMs: number): LoafSummary {
    if (!(fromMs < toMs)) throw new RangeError(`a window from ${fromMs} to ${toMs} ms`);
    this.drain();
    const inside = (this.entries as LoafEntry[]).filter(
      (entry) => entry.startTime >= fromMs && entry.startTime < toMs,
    );
    let totalMs = 0;
    let largestMs = 0;
    for (const { duration } of inside) {
      totalMs += duration;
      largestMs = Math.max(largestMs, duration);
    }
    if (this.source !== 'long-animation-frame') {
      return {
        source: this.source,
        frames: inside.length,
        totalMs,
        largestMs,
        blockingTotalMs: null,
        blockingLargestMs: null,
        scriptMs: null,
        styleLayoutMs: null,
        styleLayoutShare: null,
        scripts: [],
      };
    }

    let blockingTotalMs = 0;
    let blockingLargestMs = 0;
    let scriptMs = 0;
    let styleLayoutMs = 0;
    const byKey = new Map<string, { summary: LoafScriptSummary; key: string }>();
    for (const entry of inside) {
      blockingTotalMs += entry.blockingDuration;
      blockingLargestMs = Math.max(blockingLargestMs, entry.blockingDuration);
      if (entry.styleAndLayoutStart > 0) {
        styleLayoutMs += Math.max(0, entry.startTime + entry.duration - entry.styleAndLayoutStart);
      }
      for (const s of entry.scripts) {
        scriptMs += s.duration;
        const key = [
          s.invokerType,
          s.invoker,
          s.sourceURL,
          s.sourceFunctionName,
          s.sourceCharPosition,
        ].join('\n');
        const held = byKey.get(key)?.summary;
        byKey.set(key, {
          key,
          summary: {
            invoker: s.invoker,
            invokerType: s.invokerType,
            sourceURL: s.sourceURL,
            sourceFunctionName: s.sourceFunctionName,
            sourceCharPosition: s.sourceCharPosition,
            count: (held?.count ?? 0) + 1,
            durationMs: (held?.durationMs ?? 0) + s.duration,
            forcedStyleAndLayoutMs:
              (held?.forcedStyleAndLayoutMs ?? 0) + s.forcedStyleAndLayoutDuration,
          },
        });
      }
    }
    const scripts = [...byKey.values()]
      .sort((a, b) => b.summary.durationMs - a.summary.durationMs || (a.key < b.key ? -1 : 1))
      .slice(0, TOP_SCRIPTS)
      .map(({ summary }) => summary);
    const both = styleLayoutMs + scriptMs;
    return {
      source: this.source,
      frames: inside.length,
      totalMs,
      largestMs,
      blockingTotalMs,
      blockingLargestMs,
      scriptMs,
      styleLayoutMs,
      styleLayoutShare: both > 0 ? styleLayoutMs / both : null,
      scripts,
    };
  }

  /** What the browser has seen but not delivered yet: a phase's end must not miss a frame. */
  private drain(): void {
    if (this.observer) this.keep(this.observer.takeRecords());
  }

  private keep(entries: readonly unknown[]): void {
    for (const entry of entries) {
      if (this.entries.length < this.maxEntries) this.entries.push(entry);
      else this.dropped++;
    }
  }
}
