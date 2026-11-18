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
  templateUrl: './3-text-actions.example.html',
})
export class TextActions {}
