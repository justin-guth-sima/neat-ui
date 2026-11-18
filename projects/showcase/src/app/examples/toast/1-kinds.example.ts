import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatToasts } from '@sima/neat-ui/toast';

/**
 * One toast of each short kind. They show in the host the showcase renders once, beside its shell
 * (see the shell topic's last example).
 *
 * @capture click button
 * @gallery
 */
@Component({
  selector: 'app-kinds',
  imports: [NeatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-kinds.example.html',
})
export class Kinds {
  protected readonly toasts = inject(NeatToasts);
}
