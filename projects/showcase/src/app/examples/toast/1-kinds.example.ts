import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatToasts } from '@sima/neat-ui/toast';

/**
 * One toast of each short kind. They show in the host the showcase renders once, beside its shell
 * (see the shell topic's last example); a new toast comes to the front, above a dialog that is
 * open.
 */
@Component({
  selector: 'app-kinds',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button
        neatButton
        type="button"
        variant="outlined"
        (click)="toasts.error('Could not start src3: the stream is held by another publisher.')"
      >
        Error
      </button>
      <button
        neatButton
        type="button"
        variant="outlined"
        (click)="toasts.warning('Uploaded clip.mp4, but could not restart src2: it is in use.')"
      >
        Warning
      </button>
      <button
        neatButton
        type="button"
        variant="outlined"
        (click)="toasts.status('Stopped 2 sources.')"
      >
        Status
      </button>
    </div>
  `,
})
export class Kinds {
  protected readonly toasts = inject(NeatToasts);
}
