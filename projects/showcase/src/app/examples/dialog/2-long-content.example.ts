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
  templateUrl: './2-long-content.example.html',
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
