import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  untracked,
} from '@angular/core';
import { ɵBROWSER_CLOCK as clock, ɵreducedMotion as reducedMotion } from '@sima/neat-ui';
import { isNumber } from './geometry';
import { neatLabelColour } from './label-colour';

/** A stretch of time in which a classifier kept giving one label. */
export interface NeatLabelRun {
  readonly label: string;
  /** Epoch milliseconds. */
  readonly startMs: number;
  /** Epoch milliseconds; a run that ends before it starts is not drawn. */
  readonly endMs: number;
}

/**
 * How the strip moves: `step` jumps when the app passes a later `nowMs`; `smooth` also scrolls
 * between two updates, at real time.
 */
export type NeatTimelineMotion = 'step' | 'smooth';

/** A run as drawn: its place in the window in percent, its colour and its spoken span. */
interface Bar {
  readonly label: string;
  readonly left: number;
  readonly width: number;
  readonly colour: string;
  readonly named: boolean;
  readonly span: string;
}

/** The narrowest a run may be, as a share of the window, and still carry its label. */
const NAMED_SHARE = 0.12;
/** The axis marks the window's start, its end and two points that divide it in thirds. */
const TICKS = 3;

/**
 * How far past the last `nowMs` the smooth strip may run. A stream that stalls stops the strip
 * after this long, rather than inventing a second of data per second of silence.
 */
const MAX_AHEAD_MS = 1000;

/**
 * The drawn now in smooth mode, and the update it runs on from: that update's `nowMs` and the
 * frame-clock time at which it arrived.
 */
interface Drawn {
  /** Whether the strip is smooth now: `motion` asks for it and reduced motion does not forbid it. */
  readonly smooth: boolean;
  /** Counts the updates, so the frame loop starts again for each. */
  readonly update: number;
  readonly now: number;
  readonly from: number;
  readonly arrivedAt: number;
}

/**
 * A quiet run's fill. `neatLabelColour` gives a quiet label `--muted-foreground`, a colour for
 * text; here the label fills a stretch of the strip, and a quiet class often fills most of the
 * window, so it takes the lighter `--muted` and is never the strip's heaviest mark.
 */
const QUIET_FILL = 'var(--muted)';

/** Seconds with at most one decimal, so 8.5 stays 8.5 and 20 stays 20. */
const inSeconds = (ms: number) => Number((ms / 1000).toFixed(1));

/**
 * A classifier's recent results as a strip of coloured runs, newest at the right:
 *
 * ```html
 * <neat-label-timeline
 *   label="Last 30 s"
 *   [runs]="runs"
 *   [nowMs]="nowMs"
 *   [labels]="classes"
 *   [quiet]="['No gesture']"
 * />
 * ```
 *
 * It draws the window from `nowMs - windowMs` to `nowMs`, left to right, under an axis of four
 * ticks (−30 s, −20 s, −10 s and now for the default window). The app moves the window by
 * passing a later `nowMs`, so a test or a replay sets the time. With the default `motion="step"`
 * that is all there is: the strip jumps at the app's update rate. With `motion="smooth"` it also
 * scrolls between two updates, on animation frames at real time, so an app that updates once a
 * second still reads as moving. It never runs more than a second past the last `nowMs` (a stalled
 * stream stops the strip), and never moves backwards: a `nowMs` behind what is drawn holds the
 * strip until real time catches up. A reduced-motion setting forces `step`.
 * A run is placed by its times and clipped to the window; one that ends before it starts, lies
 * outside the window or has a time that is not a number is not drawn. Runs that overlap are drawn
 * in the order of `runs`, the later on top, so the app decides which wins. A run at least 12 % of
 * the window wide shows its label beneath it, unless the label is `quiet`; a narrower one would
 * only collide with its neighbour's. Colours come from `neatLabelColour`, by the label's place in
 * `labels` (empty means the order in which labels first appear in `runs`), as in `NeatScoreBars`.
 * The one difference is a `quiet` label: its run is filled with `--muted`, not the
 * `--muted-foreground` that `neatLabelColour` returns for text and the score bars use, because a
 * quiet class fills most of the window and must not be its heaviest mark.
 *
 * The host is a group named by `label` that holds a list with one item per drawn run, named by its
 * label and its span in seconds (as visually hidden text in the item), so a screen reader gets the runs the label text leaves out.
 */
@Component({
  selector: 'neat-label-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
  },
  template: `
    <ul class="runs" role="list">
      @for (bar of bars(); track $index) {
        <li
          class="run"
          data-slot="label-timeline-run"
          [attr.data-label]="bar.label"
          [style.left.%]="bar.left"
          [style.width.%]="bar.width"
          [style.--run]="bar.colour"
        >
          <span class="sr-only">{{ bar.span }}</span>
          @if (bar.named) {
            <span class="name" aria-hidden="true">{{ bar.label }}</span>
          }
        </li>
      }
    </ul>
    <div class="axis" aria-hidden="true">
      @for (tick of ticks(); track $index) {
        <span data-slot="label-timeline-tick">{{ tick }}</span>
      }
    </div>
  `,
  styleUrl: './label-timeline.css',
})
export class NeatLabelTimeline {
  /** The runs to draw, in the order that decides which of two overlapping ones is on top. */
  readonly runs = input.required<readonly NeatLabelRun[]>();
  /** The right edge of the window, epoch milliseconds. */
  readonly nowMs = input.required<number>();
  /** How much time the strip shows, in milliseconds. */
  readonly windowMs = input(30_000);
  /** The colour order of the labels; empty means the order of first appearance in `runs`. */
  readonly labels = input<readonly string[]>([]);
  /** Labels drawn in the muted colour and never named, such as "No gesture". */
  readonly quiet = input<readonly string[]>([]);
  /** Names the strip. */
  readonly label = input.required<string>();
  /** Whether the strip scrolls between updates (`smooth`) or only at them. */
  readonly motion = input<NeatTimelineMotion>('step');

  /**
   * Smooth mode's state. It is recomputed when an update or the mode arrives, which is also when
   * the reduced-motion setting is read, so switching it on stops the scroll at the next update.
   * The drawn now is held where it is if the update is behind it by no more than the cap (jitter:
   * it never moves backwards), and snaps to the update when it is further behind (a rewind, such as
   * a replay loop or a restarted time base, would otherwise freeze the strip). The frame loop
   * advances it between updates.
   */
  private readonly drawn = linkedSignal<{ now: number; motion: NeatTimelineMotion }, Drawn>({
    source: () => ({ now: this.nowMs(), motion: this.motion() }),
    computation: ({ now, motion }, previous) => {
      const smooth = motion === 'smooth' && !reducedMotion();
      const last = previous?.value;
      const held = smooth && last?.smooth && last.now - now <= MAX_AHEAD_MS;
      return {
        smooth,
        now: held ? Math.max(last.now, now) : now,
        from: now,
        arrivedAt: clock.now(),
        update: (last?.update ?? 0) + 1,
      };
    },
  });

  /** The right edge of the window as drawn. */
  private readonly drawnNow = computed(() =>
    this.drawn().smooth ? this.drawn().now : this.nowMs(),
  );

  /** Which update the frame loop runs for; -1 when the strip is not smooth. */
  private readonly loopFor = computed(() => (this.drawn().smooth ? this.drawn().update : -1));

  constructor() {
    // One loop per update: it asks for frames until the drawn now has run the cap past the
    // update, then idles, so a stalled stream costs no wake-ups; the next update starts it again.
    effect((onCleanup) => {
      if (this.loopFor() < 0) return;
      let handle: number | undefined;
      const frame = (): void => {
        const { arrivedAt } = untracked(this.drawn);
        const elapsed = clock.now() - arrivedAt;
        this.drawn.update((state) => {
          const now = Math.max(state.now, state.from + Math.min(MAX_AHEAD_MS, elapsed));
          return now === state.now ? state : { ...state, now };
        });
        handle = elapsed < MAX_AHEAD_MS ? clock.request(frame) : undefined;
      };
      handle = clock.request(frame);
      onCleanup(() => {
        if (handle !== undefined) clock.cancel(handle);
      });
    });
  }

  protected readonly bars = computed<readonly Bar[]>(() => {
    const now = this.drawnNow();
    const window = this.windowMs();
    if (!isNumber(now) || !isNumber(window) || window <= 0) return [];
    const from = now - window;
    // Distinct, so a repeated label does not push the next one's place in the palette on.
    const order =
      this.labels().length > 0 ? this.labels() : [...new Set(this.runs().map((run) => run.label))];
    const quiet = this.quiet();
    const bars: Bar[] = [];
    for (const { label, startMs, endMs } of this.runs()) {
      if (!isNumber(startMs) || !isNumber(endMs)) continue;
      const start = Math.max(startMs, from);
      const end = Math.min(endMs, now);
      if (end <= start) continue;
      const width = (end - start) / window;
      bars.push({
        label,
        left: ((start - from) / window) * 100,
        width: width * 100,
        colour: quiet.includes(label) ? QUIET_FILL : neatLabelColour(label, order, quiet),
        named: width >= NAMED_SHARE && !quiet.includes(label),
        span: spoken(label, now - start, now - end),
      });
    }
    return bars;
  });

  /** The axis, oldest tick first; the last is "now". */
  protected readonly ticks = computed(() => {
    const window = this.windowMs();
    if (!isNumber(window) || window <= 0) return [];
    return Array.from({ length: TICKS + 1 }, (_, index) =>
      index === TICKS ? 'now' : `−${inSeconds((window * (TICKS - index)) / TICKS)} s`,
    );
  });
}

/** "Zoom in, 20 s to 10 s ago", or "Zoom in, 8.5 s ago to now" for a run that reaches the edge. */
function spoken(label: string, startAgo: number, endAgo: number): string {
  const from = inSeconds(startAgo);
  const to = inSeconds(endAgo);
  return to === 0 ? `${label}, ${from} s ago to now` : `${label}, ${from} s to ${to} s ago`;
}
