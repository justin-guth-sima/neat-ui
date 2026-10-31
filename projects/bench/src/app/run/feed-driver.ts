import { BATCH_MS, type MessageFeed, type MessageSink } from '../synth/message-feed';

/*
 * Runs a message feed on the wall clock (design 2.2): batch k is pushed once its window,
 * [k × 100 ms, (k + 1) × 100 ms) after the start, has opened, with each message's time moved onto
 * the clock (`performance.now()`, the dot layer's), so the layer spreads the batch over the window
 * ahead. A timer that fires late pushes every batch that is due, one after another, so the
 * sequence stays the seed's however slow the machine is; the layer then gets a burst, as it would
 * from a real feed that stalled. One interval timer, no timer per message, no Angular and no
 * signals: a raw-browser-API unit (AGENTS.md), with specs.
 */
export class FeedDriver {
  private timer: ReturnType<typeof setInterval> | undefined;
  private startedAt = 0;
  /** The next batch to push. */
  private batch = 0;

  constructor(
    private readonly feed: MessageFeed,
    private readonly sink: MessageSink,
    private readonly clock: () => number = () => performance.now(),
  ) {}

  /** Pushes the first batch now and each later one as its window opens. */
  start(): void {
    if (this.timer !== undefined) throw new Error('the feed is already running');
    this.startedAt = this.clock();
    this.batch = 0;
    this.timer = setInterval(this.pushDue, BATCH_MS);
    this.pushDue();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  /** The feed's times are from its own start; the sink's are on the clock. */
  private readonly toClock: MessageSink = (edge, bytes, atMs) =>
    this.sink(edge, bytes, this.startedAt + atMs);

  private readonly pushDue = (): void => {
    const due = Math.floor((this.clock() - this.startedAt) / BATCH_MS);
    for (; this.batch <= due; this.batch++) this.feed.next(this.toClock);
  };
}
