import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatIcon } from '@sima/neat-ui';

/**
 * The action that starts something and the one that stops it: `success` with a filled `play` icon,
 * and `danger` with a filled `stop` icon. The icon goes before the label, at 16 px.
 */
@Component({
  selector: 'app-start-and-stop',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-start-and-stop.example.html',
})
export class StartAndStop {}
