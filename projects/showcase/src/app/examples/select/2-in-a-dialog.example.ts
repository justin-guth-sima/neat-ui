import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type TemplateRef,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatDialog, NeatDialogActions, NeatDialogBody } from '@sima/neat-ui/dialog';
import { NeatSelect } from '@sima/neat-ui/select';
import { SOURCES } from './sources';

/**
 * A select in a dialog that assigns a source to a channel. Press Escape with its list open, then
 * once more, and see what each one closes; the line below says how the dialog ended.
 */
@Component({
  selector: 'app-in-a-dialog',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody, NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="open(assignDialog)">
        Assign a source…
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ result() }}</p>

    <ng-template #assignDialog let-dialog>
      <neat-dialog-body>
        <neat-select
          label="Source for channel 3"
          showLabel
          placeholder="Pick a source"
          [options]="sources"
          [(value)]="source"
        />
      </neat-dialog-body>
      <neat-dialog-actions>
        <button neatButton type="button" variant="outlined" (click)="dialog.close()">Cancel</button>
        <button neatButton type="button" (click)="dialog.close(source())">Assign</button>
      </neat-dialog-actions>
    </ng-template>
  `,
})
export class InADialog {
  private readonly dialogs = inject(NeatDialog);
  protected readonly sources = SOURCES;
  protected readonly source = signal<string | null>(null);
  protected readonly result = signal('Dialog not opened yet');

  protected async open(content: TemplateRef<unknown>): Promise<void> {
    const source = await this.dialogs.open<string | null>(content, { title: 'Assign a source' })
      .closed;
    this.result.set(
      source === undefined ? 'Dialog dismissed' : `Dialog assigned ${source ?? 'nothing'}`,
    );
  }
}
