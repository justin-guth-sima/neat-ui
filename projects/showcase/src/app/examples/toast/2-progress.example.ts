import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatToasts } from '@sima/neat-ui/toast';

/** How a progress toast ends, as the outcome the button names. */
type Outcome = 'done' | 'fail' | 'unknown' | 'dismiss';

/**
 * A progress toast for work that takes a while, four ways: succeeding, failing, of unknown length
 * (`null` for the percent), and dismissed halfway, as when a dialog takes the work back. The work
 * is simulated and runs on its own, as an upload does, so leaving the page does not stop the toast
 * from reporting the outcome.
 */
@Component({
  selector: 'app-progress',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="run('done')">
        Progress, succeeding
      </button>
      <button neatButton type="button" variant="outlined" (click)="run('fail')">
        Progress, failing
      </button>
      <button neatButton type="button" variant="outlined" (click)="run('unknown')">
        Progress, unknown length
      </button>
      <button neatButton type="button" variant="outlined" (click)="run('dismiss')">
        Progress, dismissed
      </button>
    </div>
  `,
})
export class Progress {
  private readonly toasts = inject(NeatToasts);

  /** Reports for a few seconds and then settles; `dismiss` is taken away halfway. */
  protected run(outcome: Outcome): void {
    const toast = this.toasts.progress('Uploading 3 files');
    const known = outcome !== 'unknown';
    let percent = 0;
    const timer = setInterval(() => {
      percent += 8;
      if (outcome === 'dismiss' && percent >= 48) {
        // As when a dialog takes the work back: the toast goes, with no outcome.
        clearInterval(timer);
        toast.dismiss();
        return;
      }
      if (percent < 100) {
        const file = Math.min(3, Math.floor(percent / 34) + 1);
        toast.update(`clip-${file}.mp4 · file ${file} of 3`, known ? percent : null);
        return;
      }
      clearInterval(timer);
      if (outcome === 'fail') toast.fail('Upload failed: no space left on the device.');
      else toast.done('Uploaded 3 files.');
    }, 250);
  }
}
