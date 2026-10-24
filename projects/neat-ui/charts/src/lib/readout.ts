import { computed, signal } from '@angular/core';
import { neatSecondsAgo } from '@sima/neat-ui';
import { indexAt, isNumber } from './geometry';
import type { NeatChartFormat } from './types';

/*
 * What the charts that read out a sample share: the cursor that the pointer and the keys move,
 * and what a readout says. The keys, Escape and the announce rule live here once, so the time
 * chart, the stacked chart and the heatmap cannot drift apart.
 */

/** What a readout shows for a sample that was not taken. */
export const MISSING = '—';

/** A value as the chart's `format` words it, or "—" when the sample was not taken. */
export function describe(value: number | null | undefined, format: NeatChartFormat): string {
  return isNumber(value) ? format(value) : MISSING;
}

/**
 * How long before the newest sample (the last of `length`) the sample at `index` was taken, as
 * the kit words it, or null when the times do not say.
 */
export function agoText(
  times: readonly (number | null)[],
  length: number,
  index: number,
): string | null {
  const newest = times[length - 1];
  const taken = times[index];
  return isNumber(newest) && isNumber(taken) && newest >= taken
    ? neatSecondsAgo((newest - taken) / 1000)
    : null;
}

/** Where a pointer is across `element`, 0 to 1, or null while the element has no width. */
export function fractionAcross(event: MouseEvent, element: HTMLElement): number | null {
  const box = element.getBoundingClientRect();
  return box.width ? Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) : null;
}

/** One line of a time-based readout. A row with a colour is a series, and shows its swatch. */
export interface ReadoutRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly color: string | null;
}

/** What a chart with a crosshair shows at the sample the cursor is on. */
export interface Readout {
  /** The sample's place across the plot, 0 to 1. */
  readonly at: number;
  /** How long before the newest sample it was taken, when the times say. */
  readonly ago: string | null;
  readonly rows: readonly ReadoutRow[];
  /** The readout as one sentence, for the live region. */
  readonly spoken: string;
}

export function readoutAt(at: number, ago: string | null, rows: readonly ReadoutRow[]): Readout {
  return {
    at,
    ago,
    rows,
    spoken: [ago, ...rows.map((row) => `${row.label} ${row.value}`)].filter(Boolean).join(', '),
  };
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
}): ReadoutCursor<number, number> {
  return new ReadoutCursor<number, number>({
    under: (pointer) => {
      const index = indexAt(pointer, chart.length(), chart.fractions());
      return index < 0 ? null : index;
    },
    fit: (index) => (chart.length() ? Math.min(index, chart.length() - 1) : null),
    start: () => (chart.length() ? chart.length() - 1 : null),
    after: (key, current) => sampleAfter(key, current, chart.length()),
    spoken: chart.spoken,
  });
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
 */
export class ReadoutCursor<P, C> {
  private readonly pointer = signal<P | null>(null);
  /** The cursor as the last key left it. */
  private readonly keyed = signal<C | null>(null);
  /** The readout as of the last key press: the live region's text. */
  readonly announcement = signal('');

  /** What the readout reads, or null while it is hidden. */
  readonly active = computed<C | null>(() => {
    const keyed = this.keyed();
    if (keyed !== null) return this.shape.fit(keyed);
    const pointer = this.pointer();
    return pointer === null ? null : this.shape.under(pointer);
  });

  constructor(private readonly shape: CursorShape<P, C>) {}

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
