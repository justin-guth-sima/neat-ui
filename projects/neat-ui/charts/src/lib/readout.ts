import { computed, effect, type ModelSignal, signal, untracked } from '@angular/core';
import { neatSecondsAgo } from '@sima/neat-ui';
import { elapsedText, indexAt, isNumber } from './geometry';
import type { NeatChartAxis, NeatChartFormat, NeatSamplePick } from './types';

/*
 * What the charts that read out a sample share: the cursor that the pointer and the keys move,
 * what a readout says, and how the cursor meets a chart's `hovered` model (`linkHovered`). The
 * keys, Escape and the announce rule live here once, so the time chart, the stacked chart, the
 * heatmap and the label timeline cannot drift apart.
 */

/** What a readout shows for a sample that was not taken. */
export const MISSING = '—';

/** A value as the chart's `format` words it, or "—" when the sample was not taken. */
export function describe(value: number | null | undefined, format: NeatChartFormat): string {
  return isNumber(value) ? format(value) : MISSING;
}

/**
 * When the sample at `index` was taken, or null when the times do not say: how long before the
 * newest sample (the last of `length`), as the kit words it ("2 min ago"), or, on the elapsed
 * axis, how long after the first ("at 17 s"). Both are the same distance, counted from the other
 * end of the window.
 */
export function whenText(
  times: readonly (number | null)[],
  length: number,
  index: number,
  axis: NeatChartAxis = 'recent',
): string | null {
  const taken = times[index];
  if (axis === 'elapsed') {
    const first = times[0];
    return isNumber(first) && isNumber(taken) && taken >= first
      ? `at ${elapsedText((taken - first) / 1000)}`
      : null;
  }
  const newest = times[length - 1];
  return isNumber(newest) && isNumber(taken) && newest >= taken
    ? neatSecondsAgo((newest - taken) / 1000)
    : null;
}

/** Where a pointer is across `element`, 0 to 1, or null while the element has no width. */
export function fractionAcross(event: MouseEvent, element: HTMLElement): number | null {
  const box = element.getBoundingClientRect();
  return box.width ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) : null;
}

/** One line of a time-based readout. */
export interface ReadoutRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  /**
   * The index of the series whose swatch the row shows, or null for a row without one: a total,
   * or a chart's only line, which its tone colours and no swatch is needed to tell apart.
   */
  readonly series: number | null;
}

/** What a chart with a crosshair shows at the sample the cursor is on. */
export interface Readout {
  /** The sample's place across the plot, 0 to 1. */
  readonly at: number;
  /** When the sample was taken ("2 min ago", "at 17 s"), when the times say. */
  readonly when: string | null;
  readonly rows: readonly ReadoutRow[];
  /** The readout as one sentence, for the live region. */
  readonly spoken: string;
}

export function readoutAt(at: number, when: string | null, rows: readonly ReadoutRow[]): Readout {
  return {
    at,
    when,
    rows,
    spoken: [when, ...rows.map((row) => `${row.label} ${row.value}`)].filter(Boolean).join(', '),
  };
}

/**
 * The index of the sample nearest `time` among the first `length` of `times`, or -1 when `time` is
 * null or lies outside the span they cover: how a chart finds the sample an app's `hovered` names,
 * so charts sampled at different moments still meet on one crosshair.
 */
export function sampleNear(
  times: readonly (number | null)[],
  length: number,
  time: number | null,
): number {
  if (!isNumber(time)) return -1;
  let best = -1;
  let gap = Infinity;
  let first = Infinity;
  let last = -Infinity;
  for (let i = 0; i < Math.min(length, times.length); i++) {
    const taken = times[i];
    if (!isNumber(taken)) continue;
    first = Math.min(first, taken);
    last = Math.max(last, taken);
    const distance = Math.abs(taken - time);
    if (distance < gap) {
      gap = distance;
      best = i;
    }
  }
  return time < first || time > last ? -1 : best;
}

/** The sample at `index` as a click reports it: its time, and each line's value there. */
export function samplePick(
  index: number,
  times: readonly (number | null)[],
  lines: readonly { readonly key: string; readonly values: readonly (number | null)[] }[],
): NeatSamplePick {
  const time = times[index];
  return {
    time: isNumber(time) ? time : null,
    values: lines.map((line) => ({ key: line.key, value: line.values[index] ?? null })),
  };
}

/** The time of the sample at `index`, as a chart's `hovered` names it; null without one. */
export function sampleTime(times: readonly (number | null)[], index: number): number | null {
  const time = times[index];
  return isNumber(time) ? time : null;
}

/**
 * The sample a key moves a cursor over `length` samples to, or null for a key the chart does not
 * use. `current` is null while the readout is hidden, and any arrow then brings it up at the
 * newest sample.
 */
export function sampleAfter(key: string, current: number | null, length: number): number | null {
  const last = length - 1;
  if (last < 0) return null;
  switch (key) {
    case 'ArrowLeft':
      return current === null ? last : Math.max(0, current - 1);
    case 'ArrowRight':
      return current === null ? last : Math.min(last, current + 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return null;
  }
}

/**
 * How a chart tells its cursor about its data. `P` is where a pointer is (kept as a place, not a
 * cell, so the cursor follows data that shifts under it) and `C` is what the cursor points at.
 */
export interface CursorShape<P, C> {
  /** What the pointer is over, or null when there is nothing there. */
  under(pointer: P): C | null;
  /** A cursor a key chose, held to the data as it is now, or null when nothing is left. */
  fit(cursor: C): C | null;
  /** Where focus puts the cursor when nothing is shown, or null without data. */
  start(): C | null;
  /** Where a key moves the cursor (null: it is hidden), or null for a key the chart does not use. */
  after(key: string, current: C | null): C | null;
  /** The readout of a cursor as one sentence, for the live region. */
  spoken(cursor: C): string;
}

/**
 * The cursor of a chart whose readout reads one sample across its plot, the time chart's and the
 * stacked chart's: a sample is the cursor, and the pointer is a place across the plot (0 to 1),
 * so the readout follows data that shifts under it. `fractions` place the samples, as
 * `timeFractions` does.
 */
export function sampleCursor(chart: {
  length: () => number;
  fractions: () => readonly number[];
  spoken: (index: number) => string;
  /** The sample the app names through `hovered`, shown while the pointer and the keys hold none. */
  outside?: () => number | null;
}): ReadoutCursor<number, number> {
  return new ReadoutCursor<number, number>(
    {
      under: (pointer) => {
        const index = indexAt(pointer, chart.length(), chart.fractions());
        return index < 0 ? null : index;
      },
      fit: (index) => (chart.length() ? Math.min(index, chart.length() - 1) : null),
      start: () => (chart.length() ? chart.length() - 1 : null),
      after: (key, current) => sampleAfter(key, current, chart.length()),
      spoken: chart.spoken,
    },
    chart.outside,
  );
}

/**
 * The cursor a chart's readout reads. The pointer shows it while it is over the chart; with focus
 * it shows the newest, and the keys move it. A key takes it over from the pointer and a pointer
 * move gives it back. Escape hides it, but only a readout that is there: otherwise Escape belongs
 * to whatever holds the chart, such as a dialog.
 *
 * Each key press, and only a key press, writes `announcement`, which the chart renders in a polite
 * live region: a pointer move announced at every pixel would be noise, and focus alone lands on
 * the chart without a sentence in the reader's ear.
 *
 * `outside`, when given, is what the app names through the chart's `hovered` model: the readout
 * shows it while neither the pointer nor the keys hold the cursor (`own`).
 */
export class ReadoutCursor<P, C> {
  private readonly pointer = signal<P | null>(null);
  /** The cursor as the last key left it. */
  private readonly keyed = signal<C | null>(null);
  /** The readout as of the last key press: the live region's text. */
  readonly announcement = signal('');

  /** What the pointer or the keys hold, or null while they hold nothing. */
  readonly own = computed<C | null>(() => {
    const keyed = this.keyed();
    if (keyed !== null) return this.shape.fit(keyed);
    const pointer = this.pointer();
    return pointer === null ? null : this.shape.under(pointer);
  });

  /** What the readout reads: what the pointer or the keys hold, else what the app names; or null. */
  readonly active = computed<C | null>(() => this.own() ?? this.outside?.() ?? null);

  constructor(
    private readonly shape: CursorShape<P, C>,
    private readonly outside?: () => C | null,
  ) {}

  /** What the pointer at `pointer` is over, as a click there chose it: null for nothing. */
  at(pointer: P): C | null {
    return this.shape.under(pointer);
  }

  pointerTo(pointer: P): void {
    this.keyed.set(null);
    this.pointer.set(pointer);
  }

  /** The pointer leaving hides what the pointer showed; a cell a key chose stays. */
  pointerLeave(): void {
    this.pointer.set(null);
  }

  focus(): void {
    // A click focuses too, after the pointer has chosen; the pointer's cell is the one to keep.
    if (this.active() !== null) return;
    const start = this.shape.start();
    if (start !== null) this.keyed.set(start);
  }

  blur(): void {
    this.keyed.set(null);
    this.announcement.set('');
  }

  keydown(event: KeyboardEvent): void {
    const current = this.active();
    if (event.key === 'Escape') {
      if (current === null) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointer.set(null);
      this.keyed.set(null);
      this.announcement.set('');
      return;
    }
    const next = this.shape.after(event.key, current);
    if (next === null) return;
    event.preventDefault();
    this.keyed.set(next);
    const now = this.active();
    this.announcement.set(now === null ? '' : this.shape.spoken(now));
  }
}

/**
 * Ties a chart's `hovered` model to its cursor, by the kit's rule for widget interaction
 * (AGENTS.md): while the pointer or the keys hold the cursor, `hovered` follows it, named as
 * `nameOf` names it (a time, a cell), and it changes only when that name does; when they let go
 * (the pointer leaves, Escape, blur) it goes back to null. Otherwise the app may set it, and the
 * cursor shows it (the `outside` the chart gave its cursor). A chart's own names never come back
 * to it as the app's, so charts bound to one `hovered` do not answer each other. Call in an
 * injection context.
 */
export function linkHovered<C, N>(
  cursor: ReadoutCursor<unknown, C>,
  hovered: ModelSignal<N | null>,
  nameOf: (cursor: C) => N | null,
  same: (a: N | null, b: N | null) => boolean = Object.is,
): void {
  let held = false;
  effect(() => {
    const own = cursor.own();
    const name = own === null ? null : nameOf(own);
    untracked(() => {
      if (own !== null) {
        held = true;
        if (!same(hovered(), name)) hovered.set(name);
      } else if (held) {
        held = false;
        if (hovered() !== null) hovered.set(null);
      }
    });
  });
}
