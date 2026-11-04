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
import {
  NEAT_OVERLAY_DEFAULTS,
  type NeatOverlaySettings,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { PoseSource } from './pose-source';

/**
 * Two hands and a person in one `pose-estimation` message. A hand draws as MediaPipe's 21
 * landmarks and links, a person as COCO's keypoints. The `objects` rows style a pose by its
 * label: here the person is a thin grey, and the hands keep the colour of their ids. Boxes shows
 * and hides the box and label plate around each pose.
 */
@Component({
  selector: 'app-poses',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatSwitch [(checked)]="boxes">Boxes</button>
    </div>
    <div class="tiles">
      <div class="cell">
        <neat-video-tile
          [source]="poses"
          label="1"
          status="Hands and a person · 640×360"
          [settings]="settings()"
        />
      </div>
    </div>
  `,
  styleUrl: './test-pattern-tiles.example.css',
})
export class Poses {
  protected readonly poses = new PoseSource();
  protected readonly boxes = signal(true);
  protected readonly settings = computed<NeatOverlaySettings>(() => ({
    ...NEAT_OVERLAY_DEFAULTS,
    types: {
      ...NEAT_OVERLAY_DEFAULTS.types,
      'pose-estimation': {
        ...NEAT_OVERLAY_DEFAULTS.types['pose-estimation'],
        showBoxes: this.boxes(),
        objects: [{ label: 'person', color: '#9ca3af', style: 'solid', width: 1 }],
      },
    },
  }));

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.poses.start(document));
    inject(DestroyRef).onDestroy(() => this.poses.stop());
  }
}
