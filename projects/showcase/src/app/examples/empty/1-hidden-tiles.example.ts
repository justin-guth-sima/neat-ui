import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatEmpty } from '@sima/neat-ui/empty';

/**
 * A tile grid with every tile hidden. Nothing of the app is on the area, so it shows an empty
 * state with the way back: a heading, a sentence and the action that shows the tiles again.
 */
@Component({
  selector: 'app-hidden-tiles',
  imports: [NeatButton, NeatEmpty],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-hidden-tiles.example.html',
  styleUrl: './hidden-tiles.example.css',
})
export class HiddenTiles {
  protected readonly tiles = ['Front door', 'Garage', 'Loading dock', 'Parking'];
  protected readonly shown = signal(false);
}
