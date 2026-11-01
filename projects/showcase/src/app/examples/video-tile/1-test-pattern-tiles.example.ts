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
  template: `
    <div class="showcase-row">
      <button neatSwitch [(checked)]="bars">Bars</button>
      <button neatSwitch [(checked)]="selected">Selected</button>
      <button neatSwitch (checkedChange)="testPattern.setPaused($event)">Pause the source</button>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">{{ summary() }}</p>
    <div class="tiles">
      <div class="cell">
        <neat-video-tile
          [source]="testPattern"
          label="1"
          status="Test pattern · 640×360 · 30 fps"
          [bars]="bars()"
          [selected]="selected()"
          (stateChange)="state.set($event)"
        >
          <span neatTileChip class="chip">Demo</span>
        </neat-video-tile>
      </div>
      <div class="cell">
        <neat-video-tile label="2" status="Waiting for stream" [bars]="bars()" />
      </div>
    </div>
  `,
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
