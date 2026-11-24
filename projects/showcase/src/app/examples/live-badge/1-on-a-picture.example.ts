import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { NeatLiveBadge } from '@sima/neat-ui';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { NeatVideoTile } from '@sima/neat-ui/video';
import { ColorBarsSource } from './color-bars-source';

/**
 * A badge in the top-left corner of each picture, in the tile's `neatTileOverlay` layer. The
 * first tile plays a file: turn on Live and its badge says so with the pulsing live dot, at the
 * same size. The second has no picture yet, so its badge is the muted pill.
 *
 * @animated
 */
@Component({
  selector: 'app-on-a-picture',
  imports: [NeatLiveBadge, NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-on-a-picture.example.html',
  styleUrl: './on-a-picture.example.css',
})
export class OnAPicture {
  protected readonly colorBars = new ColorBarsSource();
  protected readonly live = signal(true);

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.colorBars.start(document));
    inject(DestroyRef).onDestroy(() => this.colorBars.stop());
  }
}
