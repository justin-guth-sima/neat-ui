import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatConfirm } from '@sima/neat-ui/confirm';

/**
 * Two questions and what `ask` resolved. The first is `tone: 'danger'`, for an action that cannot
 * be undone, so its confirm button is the danger one; the second keeps the default tone and words
 * its cancel button with `cancelLabel`. Try Cancel, Escape and a click on the backdrop: the first
 * two answer `false`, the backdrop does nothing.
 *
 * @capture click button:first-of-type
 */
@Component({
  selector: 'app-asking',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="askResetAll()">
        Reset all channels to global…
      </button>
      <button neatButton type="button" variant="outlined" (click)="askApplyToAll()">
        Apply to all channels…
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ answer() }}</p>
  `,
})
export class Asking {
  private readonly confirm = inject(NeatConfirm);
  protected readonly answer = signal('Not asked yet');

  protected async askResetAll(): Promise<void> {
    const reset = await this.confirm.ask({
      title: 'Reset all channels to global?',
      message: "4 settings on 3 channels go back to the global values. This can't be undone.",
      confirmLabel: 'Reset',
      tone: 'danger',
    });
    this.answer.set(`Reset all: ${reset ? 'confirmed' : 'canceled'}`);
  }

  protected async askApplyToAll(): Promise<void> {
    const apply = await this.confirm.ask({
      title: 'Apply to all channels?',
      message: 'Every channel takes the global overlay settings.',
      confirmLabel: 'Apply',
      cancelLabel: 'Not now',
    });
    this.answer.set(`Apply to all: ${apply ? 'confirmed' : 'canceled'}`);
  }
}
