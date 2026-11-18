import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';
import { NeatSlider } from '@sima/neat-ui/slider';
import { NeatSwitch } from '@sima/neat-ui/switch';
import {
  bufferSettleMs,
  lateNoticeDetails,
  type NeatGlobalBufferAction,
  type NeatLateNoticeBlocker,
  nextWarningActive,
} from '@sima/neat-ui/video';

/** Why a notice has no suggestion to offer, in words. */
const BLOCKED: Record<NeatLateNoticeBlocker, string> = {
  unsupported: 'This browser cannot set a buffer.',
  unmeasured: 'No late message has been measured yet.',
  maximum: 'A buffer that covers it would pass the largest one.',
};

/**
 * The late-metadata notice of a channel, driven by sliders in place of the lateness a tile
 * measures. Move the late share across the thresholds, and the buffer, to see the warning come,
 * go and be held off. The notice's buttons use the suggested buffer here and either raise the
 * shared buffer or follow it.
 *
 * @gallery
 */
@Component({
  selector: 'app-late-notice',
  imports: [NeatButton, NeatCallout, NeatSlider, NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-late-notice.example.html',
  styleUrl: './late-notice.example.css',
})
export class LateNotice {
  protected readonly blocked = BLOCKED;
  protected readonly share = signal(60);
  protected readonly median = signal(180);
  protected readonly percentile = signal(420);
  protected readonly buffer = signal(0);
  protected readonly followed = signal(1000);
  protected readonly supported = signal(true);
  /** On from half the messages late, off below a tenth, as it was between. */
  protected readonly warning = linkedSignal<number, boolean>({
    source: this.share,
    computation: (share, previous) => nextWarningActive(previous?.value ?? false, share / 100),
  });
  /** How long the warning is held off after the buffer changed, in ms; null when it is not. */
  protected readonly held = signal<number | null>(null);
  protected readonly details = computed(() =>
    lateNoticeDetails(
      {
        recentLateShare: this.share() / 100,
        recentLatenessMedianMs: this.median(),
        recentLatenessP90Ms: this.percentile(),
      },
      this.buffer(),
      this.supported(),
      this.followed(),
    ),
  );

  private release: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.release));
  }

  protected setBuffer(next: number): void {
    const holdMs = bufferSettleMs(this.buffer(), next);
    this.buffer.set(next);
    this.held.set(holdMs);
    clearTimeout(this.release);
    this.release = setTimeout(() => this.held.set(null), holdMs);
  }

  /** Raising lifts the buffer the channels follow, then this channel takes it like the rest. */
  protected applyShared(action: NeatGlobalBufferAction): void {
    if (action.kind === 'raise') this.followed.set(action.valueMs);
    this.setBuffer(action.valueMs);
  }
}
