import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { type NeatLabelRun, NeatLabelTimeline, type NeatRunPick } from '@sima/neat-ui/charts';
import { CLASSES, NO_GESTURE } from './data';

/** A fixed moment the strip ends at, so the example stands still. */
const NOW = Date.UTC(2026, 9, 24, 12, 0, 30);
const WINDOW_MS = 30_000;

/** Thirty seconds of results, fixed. */
const RUNS: readonly NeatLabelRun[] = [
  { label: NO_GESTURE, startMs: NOW - 30_000, endMs: NOW - 24_000 },
  { label: CLASSES[5], startMs: NOW - 24_000, endMs: NOW - 19_000 },
  { label: NO_GESTURE, startMs: NOW - 19_000, endMs: NOW - 15_000 },
  { label: CLASSES[1], startMs: NOW - 15_000, endMs: NOW - 8_000 },
  { label: NO_GESTURE, startMs: NOW - 8_000, endMs: NOW - 4_000 },
  { label: CLASSES[12], startMs: NOW - 4_000, endMs: NOW },
];

/**
 * The app reads the strip and sets it.
 *
 * - `hovered` is a moment: the one under the pointer, a run's middle while the keys hold it, or one
 *   the app sets, which reads out the run covering it.
 * - `activated` reports a click or Enter, with the run under it and the moment.
 *
 * The card shows both. Its buttons set the moment from outside, as a time chart bound to the same
 * signal would.
 *
 * @unpictured
 */
@Component({
  selector: 'app-timeline-from-the-app',
  imports: [NeatButton, NeatLabelTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-from-the-app.example.html',
  styleUrl: './report.example.css',
})
export class TimelineFromTheApp {
  protected readonly runs = RUNS;
  protected readonly now = NOW;
  protected readonly windowMs = WINDOW_MS;
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly moment = signal<number | null>(null);
  protected readonly picked = signal<NeatRunPick | null>(null);

  protected readonly momentText = computed(() => {
    const time = this.moment();
    return time === null ? 'None' : `${((NOW - time) / 1000).toFixed(1)} s ago`;
  });

  protected readonly pickedText = computed(() => {
    const pick = this.picked();
    if (!pick) return 'None yet';
    const ago = `${((NOW - pick.time) / 1000).toFixed(1)} s ago`;
    return `${pick.run?.label ?? 'Nothing'}, ${ago}`;
  });
}
