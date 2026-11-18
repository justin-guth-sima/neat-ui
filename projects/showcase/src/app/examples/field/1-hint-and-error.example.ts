import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatField } from '@sima/neat-ui/field';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * A hint under the first field and an error under the second, whose control is drawn invalid. Each
 * control is named by its field's label, and described by the note under it.
 *
 * @gallery
 */
@Component({
  selector: 'app-hint-and-error',
  imports: [NeatField, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-hint-and-error.example.html',
  styleUrl: './hint-and-error.example.css',
})
export class HintAndError {}
