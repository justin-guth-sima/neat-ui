import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
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
 * passing a later `nowMs`; the strip has no clock of its own, so a test or a replay sets the time.
 * A run is placed by its times and clipped to the window; one that ends before it starts, lies
 * outside the window or has a time that is not a number is not drawn. Runs that overlap are drawn
 * in the order of `runs`, the later on top, so the app decides which wins. A run at least 12 % of
 * the window wide shows its label beneath it, unless the label is `quiet`; a narrower one would
 * only collide with its neighbour's. Colours come from `neatLabelColour`, by the label's place in
 * `labels` (empty means the order in which labels first appear in `runs`), as in `NeatScoreBars`.
 *
 * The host is a group named by `label` that holds a list with one item per drawn run, named by its
 * label and its span in seconds, so a screen reader gets the runs the label text leaves out.
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
          data-slot="timeline-run"
          [attr.data-label]="bar.label"
          [attr.aria-label]="bar.span"
          [style.left.%]="bar.left"
          [style.width.%]="bar.width"
          [style.--run]="bar.colour"
        >
          @if (bar.named) {
            <span class="name" aria-hidden="true">{{ bar.label }}</span>
          }
        </li>
      }
    </ul>
    <div class="axis" aria-hidden="true">
      @for (tick of ticks(); track $index) {
        <span data-slot="timeline-tick">{{ tick }}</span>
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

  protected readonly bars = computed<readonly Bar[]>(() => {
    const now = this.nowMs();
    const window = this.windowMs();
    if (!isNumber(now) || !isNumber(window) || window <= 0) return [];
    const from = now - window;
    const order = this.labels().length > 0 ? this.labels() : this.runs().map((run) => run.label);
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
        colour: neatLabelColour(label, order, this.quiet()),
        named: width >= NAMED_SHARE && !this.quiet().includes(label),
        span: spoken(label, now - start, now - end),
      });
    }
    return bars;
  });

  /** The axis, oldest tick first; the last is "now". */
  protected readonly ticks = computed(() => {
    const window = this.windowMs();
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
