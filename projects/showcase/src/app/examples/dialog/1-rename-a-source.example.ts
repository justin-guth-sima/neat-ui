import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type TemplateRef,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import {
  NeatDialog,
  NeatDialogActions,
  NeatDialogBody,
  type NeatDialogRef,
} from '@sima/neat-ui/dialog';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatSwitch } from '@sima/neat-ui/switch';

/**
 * A dialog around a template, named by `title`. The template gets the `NeatDialogRef` as its
 * implicit context (`let-dialog`) and closes the dialog with a result: `open` returns the ref, and
 * its `closed` settles with the name, or `undefined` when the dialog was dismissed. While saving,
 * `setDismissible(false)` blocks Escape, the backdrop and the close button, and the buttons are
 * `aria-disabled` rather than `disabled`: the button that was pressed has focus, and a disabled
 * control loses it, which would leave the keyboard outside the dialog. The switch turns the
 * dismissing off and on by hand.
 *
 * @capture click button[neatButton]
 */
@Component({
  selector: 'app-rename-a-source',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody, NeatInput, NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" (click)="open(renameDialog)">
        Rename source…
      </button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ result() }}</p>

    <ng-template #renameDialog let-dialog>
      <neat-dialog-body>
        <div class="dialog-form">
          <label class="dialog-field">
            <span>Name</span>
            <input neatInput #name value="Front door" [readOnly]="saving()" />
          </label>
          <button
            neatSwitch
            [disabled]="saving()"
            [checked]="dialog.dismissible()"
            (checkedChange)="dialog.setDismissible($event)"
          >
            Escape and the backdrop close this dialog
          </button>
        </div>
      </neat-dialog-body>
      <neat-dialog-actions>
        <button
          neatButton
          type="button"
          variant="outlined"
          [attr.aria-disabled]="saving() || null"
          (click)="saving() || dialog.close()"
        >
          Cancel
        </button>
        <button
          neatButton
          type="button"
          [attr.aria-disabled]="saving() || null"
          (click)="saving() || save(dialog, name.value)"
        >
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </neat-dialog-actions>
    </ng-template>
  `,
  styleUrl: './rename-a-source.example.css',
})
export class RenameASource {
  private readonly dialogs = inject(NeatDialog);
  protected readonly result = signal('Not opened yet');
  protected readonly saving = signal(false);

  protected async open(content: TemplateRef<unknown>): Promise<void> {
    const name = await this.dialogs.open<string>(content, { title: 'Rename source' }).closed;
    this.result.set(name === undefined ? 'Rename: dismissed' : `Rename: saved "${name}"`);
  }

  /** Saving takes a moment, during which the dialog may not be dismissed. */
  protected save(dialog: NeatDialogRef<string>, name: string): void {
    this.saving.set(true);
    dialog.setDismissible(false);
    setTimeout(() => {
      this.saving.set(false);
      dialog.close(name);
    }, 1500);
  }
}
