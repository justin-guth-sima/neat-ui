import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type TemplateRef,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatDialog, NeatDialogActions, NeatDialogBody } from '@sima/neat-ui/dialog';

/**
 * A `large` dialog whose content is taller than the screen allows: the body scrolls, and the title
 * and the actions stay in view.
 *
 * @capture click button[neatButton]
 */
@Component({
  selector: 'app-long-content',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="open(longDialog)">
        Large dialog with long content…
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ result() }}</p>

    <ng-template #longDialog let-dialog>
      <neat-dialog-body>
        <ul class="dialog-list">
          @for (line of lines; track line) {
            <li>{{ line }}</li>
          }
        </ul>
      </neat-dialog-body>
      <neat-dialog-actions>
        <button neatButton type="button" (click)="dialog.close()">Done</button>
      </neat-dialog-actions>
    </ng-template>
  `,
  styleUrl: './long-content.example.css',
})
export class LongContent {
  private readonly dialogs = inject(NeatDialog);
  protected readonly result = signal('Not opened yet');
  protected readonly lines = Array.from(
    { length: 40 },
    (_, index) => `Source src${index + 1}: assigned, waiting to start`,
  );

  protected async open(content: TemplateRef<unknown>): Promise<void> {
    await this.dialogs.open(content, { title: 'Sources', size: 'large' }).closed;
    this.result.set('Sources: closed');
  }
}
