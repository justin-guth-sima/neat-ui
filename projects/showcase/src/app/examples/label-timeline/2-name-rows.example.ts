import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatLabelRun, NeatLabelTimeline } from '@sima/neat-ui/charts';
import { CLASSES, NO_GESTURE } from './data';

const WINDOW_MS = 30_000;

/**
 * A busy classifier, a gesture every one to two seconds, with its names in one row and in two.
 *
 * The names stand above the strip, each from its run's start. From the newest run back, a name goes
 * into the first row where it keeps clear of the newer names. So the latest gesture is always
 * named.
 *
 * `labelRows` of 2 names about twice as many. A name that fits in no row is left out, and the
 * readout and the screen reader's list still say it.
 *
 * @gallery
 */
@Component({
  selector: 'app-name-rows',
  imports: [NeatLabelTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-section">
      @for (rows of rowCounts; track rows) {
        <p class="showcase-muted">{{ rows === 1 ? 'One row (the default)' : 'Two rows' }}</p>
        <neat-label-timeline
          [label]="'Last 30 s, ' + (rows === 1 ? 'one row' : 'two rows') + ' of names'"
          [runs]="runs"
          [nowMs]="nowMs"
          [windowMs]="windowMs"
          [labels]="labels"
          [quiet]="quiet"
          [labelRows]="rows"
        />
      }
    </div>
  `,
})
export class NameRows {
  protected readonly rowCounts = [1, 2];
  protected readonly windowMs = WINDOW_MS;
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly nowMs = Date.now();
  /** Gestures back to back, 1.2 to 2.4 s each, with a short "No gesture" now and then. */
  protected readonly runs: readonly NeatLabelRun[] = denseRuns(this.nowMs);
}

function denseRuns(now: number): NeatLabelRun[] {
  const runs: NeatLabelRun[] = [];
  let start = now - WINDOW_MS;
  for (let step = 0; start < now; step++) {
    const quiet = step % 5 === 4;
    const length = quiet ? 800 : 1200 + ((step * 7) % 4) * 400;
    const label = quiet ? NO_GESTURE : CLASSES[1 + ((step * 5) % (CLASSES.length - 1))];
    runs.push({ label, startMs: start, endMs: Math.min(start + length, now) });
    start += length;
  }
  return runs;
}
