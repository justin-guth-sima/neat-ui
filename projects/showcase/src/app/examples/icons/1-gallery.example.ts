import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NEAT_ICON_NAMES, NeatIcon } from '@sima/neat-ui';

/**
 * Every name `neat-icon` accepts, in the order of `NEAT_ICON_NAMES`, drawn at 24 px. An icon takes
 * its color from the text around it.
 *
 * @gallery
 */
@Component({
  selector: 'app-gallery',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-gallery.example.html',
  styleUrl: './gallery.example.css',
})
export class Gallery {
  protected readonly names = NEAT_ICON_NAMES;
}
