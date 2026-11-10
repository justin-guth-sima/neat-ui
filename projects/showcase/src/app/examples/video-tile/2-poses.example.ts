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
import { SIMA_PALETTE } from '@sima/neat-ui';
import { NeatSwitch } from '@sima/neat-ui/switch';
import {
  NEAT_OVERLAY_DEFAULTS,
  type NeatOverlaySettings,
  type NeatTileFrame,
  NeatVideoTile,
} from '@sima/neat-ui/video';
import { PoseSource } from './pose-source';

/**
 * Two hands and a person in one `pose-estimation` message. A hand draws as MediaPipe's 21 landmarks
 * and links, and a person as COCO's keypoints.
 *
 * The `objects` rows style a pose by its label. Here the person is a thin light gray, and the hands
 * keep the color of their ids.
 *
 * Try the switches. Boxes shows and hides the box and label plate around each pose. Mirror flips
 * the picture and the poses, not their labels.
 *
 * The line under the switches is fed by the tile's `frameListener`. It gets each frame's matched
 * messages outside Angular, so it writes its signal only when the count changes.
 *
 * @gallery
 */
@Component({
  selector: 'app-poses',
  imports: [NeatSwitch, NeatVideoTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatSwitch [(checked)]="boxes">Boxes</button>
      <button neatSwitch [(checked)]="mirror">Mirror</button>
    </div>
    <p>{{ poseCount() }} {{ poseCount() === 1 ? 'pose' : 'poses' }} in this frame</p>
    <div class="tiles">
      <div class="cell">
        <neat-video-tile
          [source]="poses"
          label="1"
          status="Hands and a person · 640×360"
          [settings]="settings()"
          [mirror]="mirror()"
          [frameListener]="countPoses"
        />
      </div>
    </div>
  `,
  styleUrl: './test-pattern-tiles.example.css',
})
export class Poses {
  protected readonly poses = new PoseSource();
  protected readonly boxes = signal(true);
  protected readonly mirror = signal(false);
  protected readonly poseCount = signal(0);
  protected readonly countPoses = ({ messages }: NeatTileFrame): void => {
    const found = messages.find(({ message }) => message.type === 'pose-estimation');
    const poses = (found?.message.data as { poses?: readonly unknown[] } | undefined)?.poses;
    this.poseCount.set(poses?.length ?? 0);
  };
  protected readonly settings = computed<NeatOverlaySettings>(() => ({
    ...NEAT_OVERLAY_DEFAULTS,
    types: {
      ...NEAT_OVERLAY_DEFAULTS.types,
      'pose-estimation': {
        ...NEAT_OVERLAY_DEFAULTS.types['pose-estimation'],
        showBoxes: this.boxes(),
        objects: [{ label: 'person', color: SIMA_PALETTE.backgroundAlt, style: 'solid', width: 1 }],
      },
    },
  }));

  constructor() {
    const document = inject(DOCUMENT);
    afterNextRender(() => this.poses.start(document));
    inject(DestroyRef).onDestroy(() => this.poses.stop());
  }
}
