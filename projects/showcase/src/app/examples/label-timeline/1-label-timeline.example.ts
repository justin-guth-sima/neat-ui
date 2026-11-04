import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatLabelRun, NeatLabelTimeline } from '@sima/neat-ui/charts';
import { CLASSES, classAt, durationAt, NO_GESTURE } from './data';

const WINDOW_MS = 30_000;
const TICK_MS = 250;
/** The gesture held when the example opens, and how much of the window it already fills. */
const HELD = CLASSES[2];
const HELD_MS = 5000;

/**
 * The last 30 s of a gesture classifier. The window advances every 250 ms; a new run opens when
 * the class changes and grows until the next one. It opens with "Pointing with two fingers" held
 * for the last 5 s, a name wider than its run, which the timeline cuts with an ellipsis. "No gesture" is `quiet`, so it is drawn muted and
 * never named, and a gesture shorter than 12 % of the window (3.6 s) keeps its colour but no label.
 * Runs that have left the window are dropped here: the timeline clips what it is given, but the app
 * is what knows it will not need them again.
 */
@Component({
  selector: 'app-gesture-timeline',
  imports: [NeatLabelTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-label-timeline
      label="Last 30 s"
      [runs]="runs()"
      [nowMs]="nowMs()"
      [windowMs]="windowMs"
      [labels]="labels"
      [quiet]="quiet"
    />
  `,
})
export class GestureTimeline {
  protected readonly windowMs = WINDOW_MS;
  protected readonly labels = CLASSES;
  protected readonly quiet = [NO_GESTURE];
  protected readonly nowMs = signal(Date.now());
  protected readonly runs = signal<readonly NeatLabelRun[]>([]);

  constructor() {
    let step = 0;
    // Fill the window with history, so the example starts full rather than empty.
    let start = this.nowMs() - WINDOW_MS;
    const heldFrom = this.nowMs() - HELD_MS;
    const history: NeatLabelRun[] = [];
    while (start < heldFrom) {
      const end = Math.min(start + durationAt(step), heldFrom);
      history.push({ label: classAt(step), startMs: start, endMs: end });
      start = end;
      step++;
    }
    // The held gesture reaches "now" and goes on a little, so it is still the latest result.
    let runEnd = this.nowMs() + 1000;
    history.push({ label: HELD, startMs: start, endMs: runEnd });
    this.runs.set(history);

    const timer = setInterval(() => {
      const now = Date.now();
      this.nowMs.set(now);
      // The newest run reaches `now` while it is the latest result; a new one opens after it.
      if (now >= runEnd) {
        const next = { label: classAt(step), startMs: runEnd, endMs: runEnd + durationAt(step) };
        step++;
        runEnd = next.endMs;
        this.runs.update((runs) => [...runs, next].filter((run) => run.endMs > now - WINDOW_MS));
      }
    }, TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
