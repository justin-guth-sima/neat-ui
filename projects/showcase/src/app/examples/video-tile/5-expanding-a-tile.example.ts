import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatVideoTile } from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

/**
 * `expandControl` gives the tile a button in its top-left corner that shows it over the whole
 * window, and puts it back. The video plays on, and the detections take the new size.
 *
 * Hover the tile, or Tab to its button, and press it; Close or Escape puts it back. The button
 * above the tile opens it through the tile's `expanded`, bound to the app's own state. The tile's
 * button and Escape set that state back.
 */
@Component({
  selector: 'app-expanding-a-tile',
  imports: [NeatButton, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-expanding-a-tile.example.html',
  styleUrl: './test-pattern-tiles.example.css',
})
export class ExpandingATile {
  protected readonly testPattern = new TestPatternSource();
  protected readonly expanded = signal(false);

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
