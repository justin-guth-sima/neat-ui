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
 * The app reads the strip and sets it: `hovered` is a moment (the one under the pointer, or a run's
 * middle while the keys hold it, or one the app sets, which reads out the run covering it), and
 * `activated` reports a click or Enter with the run under it and the moment. The card shows both,
 * and its buttons set the moment from outside, as a time chart bound to the same signal would.
 */
@Component({
  selector: 'app-timeline-from-the-app',
  imports: [NeatButton, NeatLabelTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="beside">
      <neat-label-timeline
        label="Last 30 s"
        [runs]="runs"
        [nowMs]="now"
        [windowMs]="windowMs"
        [labels]="labels"
        [quiet]="quiet"
        [(hovered)]="moment"
        (activated)="picked.set($event)"
      />
      <div class="report">
        <dl>
          <dt>Hovered</dt>
          <dd>{{ momentText() }}</dd>
          <dt>Last click</dt>
          <dd>{{ pickedText() }}</dd>
        </dl>
        <div class="actions">
          <button
            neatButton
            type="button"
            size="small"
            variant="secondary"
            (click)="moment.set(now - 20_000)"
          >
            Show 20 s ago
          </button>
          <button
            neatButton
            type="button"
            size="small"
            variant="outlined"
            (click)="moment.set(null)"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  `,
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
