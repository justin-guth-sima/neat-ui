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
 * A dialog around a template, named by `title`.
 *
 * The template gets the `NeatDialogRef` as its implicit context (`let-dialog`), and closes the
 * dialog with a result. `open` returns the ref. Its `closed` settles with the name, or `undefined`
 * when the dialog was dismissed.
 *
 * While saving, `setDismissible(false)` blocks Escape, the backdrop and the close button. The
 * buttons are `aria-disabled` rather than `disabled`. The button that was pressed has focus, and a
 * disabled control loses it, which would leave the keyboard outside the dialog.
 *
 * The switch turns the dismissing off and on by hand.
 *
 * @capture click button[neatButton]
 * @gallery
 */
@Component({
  selector: 'app-rename-a-source',
  imports: [NeatButton, NeatDialogActions, NeatDialogBody, NeatInput, NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-rename-a-source.example.html',
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
