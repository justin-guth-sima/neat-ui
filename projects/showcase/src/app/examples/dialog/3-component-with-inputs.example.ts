import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatDialog } from '@sima/neat-ui/dialog';
import { SourceDialog, type SourceKind } from './source-dialog';

/**
 * A component as the dialog's content, which takes values for its inputs from the opener
 * (`inputs`, typed by the component): here the slot it is for and the kind it starts on, Camera.
 * The component asks for its `NeatDialogRef` by injection and closes the dialog with the choice.
 */
@Component({
  selector: 'app-component-with-inputs',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="open()">
        Change source of src3…
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ result() }}</p>
  `,
})
export class ComponentWithInputs {
  private readonly dialogs = inject(NeatDialog);
  protected readonly result = signal('Not opened yet');

  protected async open(): Promise<void> {
    const kind = await this.dialogs.open<SourceDialog, SourceKind>(SourceDialog, {
      title: 'Change source',
      inputs: { slot: 3, startOn: 'camera' },
    }).closed;
    this.result.set(kind === undefined ? 'Source: dismissed' : `Source: ${kind}`);
  }
}
