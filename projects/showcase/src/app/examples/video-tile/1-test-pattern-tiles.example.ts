import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { type NeatTileState, NeatVideoTile } from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

/**
 * The first tile plays a canvas test pattern with a detection every other frame, which the tile
 * holds in between. Pause the source and the tile goes stopped a moment later, which the readout
 * says. The second has no stream, so it is empty. Bars shows and hides the bar of both.
 */
@Component({
  selector: 'app-test-pattern-tiles',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-test-pattern-tiles.example.html',
  styleUrl: './test-pattern-tiles.example.css',
})
export class TestPatternTiles {
  protected readonly testPattern = new TestPatternSource();
  protected readonly bars = signal(true);
  protected readonly selected = signal(false);
  protected readonly state = signal<NeatTileState>('empty');
  protected readonly summary = computed(() => `First tile: ${this.state()}`);

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
