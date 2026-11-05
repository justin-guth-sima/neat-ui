import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ɵBROWSER_CLOCK as clock, ɵreducedMotion as reducedMotion } from '@sima/neat-ui';
import { isNumber } from './geometry';
import { neatLabelColour } from './label-colour';
import { type NameBox, placeNames } from './name-rows';
import { fractionAcross, ReadoutCursor } from './readout';
import { textWidth, watchWidth } from './strip-measure';

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

/** A run as drawn: its place in the window in percent, its colour and its span in words. */
interface Bar {
  readonly label: string;
  /** The run's own start, which tells it apart for the readout's cursor as the strip moves. */
  readonly startMs: number;
  readonly left: number;
  readonly width: number;
  readonly colour: string;
  readonly quiet: boolean;
  /** When it was, "20 s to 10 s ago", as the readout shows it. */
  readonly span: string;
  /** Its label and span as one phrase, for the hidden list and the live region. */
  readonly spoken: string;
}

/** A name as drawn above the strip: its run's label, where it starts (px) and its row (0 lowest). */
interface ShownName {
  /** Tells the run apart as the strip moves: its start and its label. */
  readonly key: string;
  readonly label: string;
  readonly x: number;
  readonly row: number;
}

/** What the readout shows: the run's label and span, beside its middle (0 to 1 across the strip). */
interface RunReadout {
  readonly at: number;
  readonly label: string;
  readonly span: string;
}

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
 * in the order of `runs`, the later on top, so the app decides which wins.
 *
 * The runs' names stand above the strip, outside the runs, each from a rule at its run's start
 * (held back from the strip's right end) and as wide as it needs, so a gesture of a second still
 * has its name. They are laid out in `labelRows` rows, 1 by default, the first next to the strip:
 * from the newest run back, each name goes into the first row where it keeps a gap from the newer
 * names, so the latest result is the one named. A name that fits in no row is not drawn; the
 * readout and the hidden list still say it. A `quiet` label is never named. While the strip
 * scrolls a name keeps its row as long as it fits there, so names do not hop between rows from
 * frame to frame. The names are measured as drawn and laid out again when the strip's width
 * changes.
 *
 * Colours come from `neatLabelColour`, by the label's place in `labels` (empty means the order in
 * which labels first appear in `runs`), as in `NeatScoreBars`. The one difference is a `quiet` label: its run is filled with `--muted`, not the
 * `--muted-foreground` that `neatLabelColour` returns for text and the score bars use, because a
 * quiet class fills most of the window and must not be its heaviest mark.
 *
 * The host is a group named by `label` that holds a list with one item per drawn run, named by its
 * label and its span in seconds (as visually hidden text in the item), so a screen reader gets the runs the label text leaves out.
 * The pointer over a run, quiet ones included, shows a readout beside its middle with its label
 * and its span ("Zoom in" over "20 s to 10 s ago"), as the other charts read out what lies under
 * the pointer; it follows the run while the strip scrolls. The strip is one tab stop: focus reads
 * out the newest run, Left and Right step to the run before or after it in time, Home and End go
 * to the oldest and the newest, and Escape hides the readout. Each key press, and only a key
 * press, is repeated in a polite live region.
 */
@Component({
  selector: 'neat-label-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'group',
    tabindex: '0',
    '[attr.aria-label]': 'label()',
    '(focus)': 'cursor.focus()',
    '(blur)': 'cursor.blur()',
    '(keydown)': 'cursor.keydown($event)',
  },
  template: `
    <div #nameArea class="names" aria-hidden="true" [style.--rows]="rows()">
      @for (name of names(); track name.key) {
        <span
          class="name"
          data-slot="label-timeline-name"
          [style.left.px]="name.x"
          [style.--row]="name.row"
          >{{ name.label }}</span
        >
      }
      <span #probe class="name probe"></span>
    </div>
    <ul
      class="runs"
      role="list"
      (pointermove)="onPointerMove($event)"
      (pointerleave)="cursor.pointerLeave()"
    >
      @for (bar of bars(); track $index) {
        <li
          class="run"
          data-slot="label-timeline-run"
          [attr.data-label]="bar.label"
          [style.left.%]="bar.left"
          [style.width.%]="bar.width"
          [style.--run]="bar.colour"
        >
          <span class="sr-only">{{ bar.spoken }}</span>
        </li>
      }
      @if (readout(); as readout) {
        <li
          class="readout"
          aria-hidden="true"
          [attr.data-flip]="readout.at > 0.5 ? '' : null"
          [style.--at]="readout.at"
        >
          <span class="row">{{ readout.label }}</span>
          <span class="when">{{ readout.span }}</span>
        </li>
      }
    </ul>
    <div class="axis" aria-hidden="true">
      @for (tick of ticks(); track $index) {
        <span data-slot="label-timeline-tick">{{ tick }}</span>
      }
    </div>
    <span class="sr-only" aria-live="polite">{{ cursor.announcement() }}</span>
  `,
  styleUrls: ['./readout.css', './label-timeline.css'],
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
   * How many rows of names stand above the strip, a positive whole number. More rows name more of
   * a busy strip; a name that fits in none is left out, and the readout and the hidden list still
   * say it.
   */
  readonly labelRows = input(1);

  /** `labelRows` as a whole number of rows, 1 for anything that is not one. */
  protected readonly rows = computed(() => {
    const rows = this.labelRows();
    return Number.isFinite(rows) && rows >= 1 ? Math.floor(rows) : 1;
  });

  private readonly nameArea = viewChild.required<ElementRef<HTMLElement>>('nameArea');
  private readonly probe = viewChild.required<ElementRef<HTMLElement>>('probe');
  /** The strip's width in px as last measured, 0 until it is. */
  private readonly stripWidth = signal(0);
  /** How wide each label's name is drawn, the gap after it included, as measured with the probe. */
  private readonly nameWidths = signal<ReadonlyMap<string, number>>(new Map());
  /** The labels that may be named: those of the runs that are not quiet. */
  private readonly namedLabels = computed(
    () =>
      [...new Set(this.runs().map((run) => run.label))].filter(
        (label) => !this.quiet().includes(label),
      ),
    { equal: (a, b) => a.length === b.length && a.every((label, i) => label === b[i]) },
  );

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
    const destroyRef = inject(DestroyRef);
    // The strip's width now, at each resize and once the fonts are in, each time with every name
    // measured again, since a resize may come with another font or zoom; read after rendering and
    // in the observer's callback, never while the view computes what to draw.
    afterNextRender(() => {
      const stop = watchWidth(this.nameArea().nativeElement, (width) => {
        this.nameWidths.set(this.measure(untracked(this.namedLabels), new Map()));
        this.stripWidth.set(width);
      });
      destroyRef.onDestroy(stop);
    });
    // A label first seen after that is measured once it has rendered.
    afterRenderEffect(() => {
      const widths = this.nameWidths();
      if (this.namedLabels().some((label) => !widths.has(label))) {
        this.nameWidths.set(this.measure(this.namedLabels(), widths));
      }
    });
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
      const span = spanText(now - start, now - end);
      bars.push({
        label,
        startMs,
        left: ((start - from) / window) * 100,
        width: width * 100,
        colour: quiet.includes(label) ? QUIET_FILL : neatLabelColour(label, order, quiet),
        quiet: quiet.includes(label),
        span,
        spoken: `${label}, ${span}`,
      });
    }
    return bars;
  });

  /**
   * The names above the strip, newest first. Recomputed with the runs (every frame while the strip
   * scrolls), the strip's width, the names' widths and the rows, each name kept in the row it had
   * while it still fits there.
   */
  protected readonly names = linkedSignal<
    {
      bars: readonly Bar[];
      width: number;
      widths: ReadonlyMap<string, number>;
      rows: number;
    },
    readonly ShownName[]
  >({
    source: () => ({
      bars: this.bars(),
      width: this.stripWidth(),
      widths: this.nameWidths(),
      rows: this.rows(),
    }),
    computation: ({ bars, width, widths, rows }, previous) => {
      const labels = new Map<string, string>();
      const boxes: NameBox[] = [];
      // Newest first; of two runs with one start, the later in `runs`, which is drawn on top.
      for (const bar of [...bars].reverse().sort((a, b) => b.startMs - a.startMs)) {
        const nameWidth = widths.get(bar.label);
        if (bar.quiet || nameWidth === undefined) continue;
        const key = `${bar.startMs}\u0000${bar.label}`;
        labels.set(key, bar.label);
        boxes.push({ key, left: (bar.left / 100) * width, width: nameWidth });
      }
      const before = new Map((previous?.value ?? []).map((name) => [name.key, name.row]));
      return [...placeNames(boxes, width, rows, before).values()].map(({ key, x, row }) => ({
        key,
        label: labels.get(key) as string,
        x,
        row,
      }));
    },
  });

  /** `widths` with the width of each of `labels` it lacks, as the probe draws it. */
  private measure(
    labels: readonly string[],
    widths: ReadonlyMap<string, number>,
  ): ReadonlyMap<string, number> {
    const probe = this.probe().nativeElement;
    const measured = new Map(widths);
    for (const label of labels) {
      if (!measured.has(label)) measured.set(label, textWidth(probe, label));
    }
    probe.textContent = '';
    return measured;
  }

  /** The drawn runs from the oldest to the newest, the order the keys walk them in. */
  private readonly inTime = computed(() =>
    [...this.bars()].sort((a, b) => a.startMs - b.startMs || a.left - b.left),
  );

  /** The run a cursor (a run's `startMs`) points at, the later of two with one start. */
  private barAt(startMs: number): Bar | undefined {
    return lastOf(this.bars(), (bar) => bar.startMs === startMs);
  }

  /**
   * The readout's cursor: a run, by its start, so a run a key chose stays chosen while the strip
   * moves and older runs leave; the pointer is a place across the strip (0 to 1), so the readout
   * shows whichever run is under it as the runs slide by.
   */
  protected readonly cursor = new ReadoutCursor<number, number>({
    // The topmost run under the place: later runs are drawn over earlier ones.
    under: (fraction) =>
      lastOf(
        this.bars(),
        (bar) => fraction * 100 >= bar.left && fraction * 100 <= bar.left + bar.width,
      )?.startMs ?? null,
    // A chosen run that has left the strip hands over to the oldest one still on it.
    fit: (startMs) => {
      const runs = this.inTime();
      if (!runs.length) return null;
      if (this.barAt(startMs)) return startMs;
      return (runs.find((bar) => bar.startMs >= startMs) ?? runs[runs.length - 1]).startMs;
    },
    start: () => {
      const runs = this.inTime();
      return runs.length ? runs[runs.length - 1].startMs : null;
    },
    after: (key, current) => {
      const runs = this.inTime();
      const last = runs.length - 1;
      if (last < 0) return null;
      // Hidden, an arrow brings the readout up at the newest run.
      const index = current === null ? null : runs.findIndex((bar) => bar.startMs === current);
      const next = {
        ArrowLeft: index === null ? last : index - 1,
        ArrowRight: index === null ? last : index + 1,
        Home: 0,
        End: last,
      }[key];
      return next === undefined ? null : runs[Math.min(last, Math.max(0, next))].startMs;
    },
    spoken: (startMs) => this.barAt(startMs)?.spoken ?? '',
  });

  protected readonly readout = computed((): RunReadout | null => {
    const startMs = this.cursor.active();
    const bar = startMs === null ? undefined : this.barAt(startMs);
    return bar ? { at: (bar.left + bar.width / 2) / 100, label: bar.label, span: bar.span } : null;
  });

  protected onPointerMove(event: MouseEvent): void {
    const fraction = fractionAcross(event, event.currentTarget as HTMLElement);
    if (fraction !== null) this.cursor.pointerTo(fraction);
  }

  /** The axis, oldest tick first; the last is "now". */
  protected readonly ticks = computed(() => {
    const window = this.windowMs();
    if (!isNumber(window) || window <= 0) return [];
    return Array.from({ length: TICKS + 1 }, (_, index) =>
      index === TICKS ? 'now' : `−${inSeconds((window * (TICKS - index)) / TICKS)} s`,
    );
  });
}

/** The last of `bars` that `test` holds for: the topmost, since later runs are drawn on top. */
function lastOf(bars: readonly Bar[], test: (bar: Bar) => boolean): Bar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) if (test(bars[i])) return bars[i];
  return undefined;
}

/** "20 s to 10 s ago", or "8.5 s ago to now" for a run that reaches the edge. */
function spanText(startAgo: number, endAgo: number): string {
  const from = inSeconds(startAgo);
  const to = inSeconds(endAgo);
  return to === 0 ? `${from} s ago to now` : `${from} s to ${to} s ago`;
}
