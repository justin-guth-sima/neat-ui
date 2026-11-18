import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NeatLabelRun, NeatLabelTimeline, NeatTimelineMotion } from '@sima/neat-ui/charts';
import { CLASSES, classAt, durationAt, NO_GESTURE } from './data';

const WINDOW_MS = 30_000;
const TICK_MS = 1000;
/** The gesture held when the example opens, and how much of the window it already fills. */
const HELD = CLASSES[2];
const HELD_MS = 5000;

/**
 * The last 30 s of a gesture classifier, shown twice with the same runs. The top strip is
 * `motion="step"`, and the bottom one `motion="smooth"`.
 *
 * The window advances once a second, the rate at which `step` jumps and `smooth` scrolls in
 * between. A new run opens when the class changes, and grows until the next one.
 *
 * It opens with "Pointing with two fingers" held for the last 5 s. The name is wider than its run,
 * so it stands above the strip, held back from its right end. "No gesture" is `quiet`, so it is
 * drawn muted and never named. The names share one row, so a name that would run into a newer one's
 * is left out.
 *
 * Try pointing at a run, a quiet one too, or focus a strip and use the arrow keys. The readout says
 * its label and when it was.
 *
 * Runs that have left the window are dropped here. The timeline clips what it is given, but the app
 * is what knows it will not need them again.
 *
 * @gallery
 * @animated
 */
@Component({
  selector: 'app-gesture-timeline',
  imports: [NeatLabelTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-label-timeline.example.html',
})
export class GestureTimeline {
  protected readonly motions: readonly NeatTimelineMotion[] = ['step', 'smooth'];
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
