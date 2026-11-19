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
import { NeatVideoTile } from '@sima/neat-ui/video';
import { TestPatternSource } from './test-pattern-source';

/**
 * Two tiles without bars, as a page with one large video shows them, each saying its trouble with
 * `notice`. The first plays the test pattern. Turn on Inference stopped and its notice shows as a
 * warning chip in the picture's corner. Pause the source and the notice moves to the middle once
 * the tile has stopped. The second has no stream and says "No signal".
 */
@Component({
  selector: 'app-notice',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-notice.example.html',
  styleUrl: './test-pattern-tiles.example.css',
})
export class Notice {
  protected readonly testPattern = new TestPatternSource();
  protected readonly inferenceStopped = signal(false);
  /** What keeps the first tile from showing as it should; null while all is well. */
  protected readonly trouble = computed(() =>
    this.inferenceStopped() ? 'Inference stopped' : null,
  );

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.testPattern.start(document));
    inject(DestroyRef).onDestroy(() => this.testPattern.stop());
  }
}
