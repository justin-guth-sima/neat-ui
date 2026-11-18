import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * A note under the input it describes (`aria-describedby`), with an inline button in its text.
 *
 * @gallery
 */
@Component({
  selector: 'app-under-a-control',
  imports: [NeatInlineButton, NeatInput, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-under-a-control.example.html',
  styleUrl: './under-a-control.example.css',
})
export class UnderAControl {}
