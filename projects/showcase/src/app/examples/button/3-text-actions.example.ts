import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';

/**
 * A destructive action among text buttons: Delete is `danger-text`, hovering as Rename and
 * Duplicate do, with its label kept red.
 */
@Component({
  selector: 'app-text-actions',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="text">Rename</button>
      <button neatButton type="button" variant="text">Duplicate</button>
      <button neatButton type="button" variant="danger-text">Delete</button>
    </div>
  `,
})
export class TextActions {}
