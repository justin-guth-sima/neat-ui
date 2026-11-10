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
  template: `
    <div class="sliders">
      <span
        >Late messages <span class="showcase-code">{{ share() }}%</span></span
      >
      <neat-slider label="Late messages" [min]="0" [max]="100" [step]="5" [(value)]="share" />
      <span
        >Median lateness <span class="showcase-code">{{ median() }} ms</span></span
      >
      <neat-slider label="Median lateness" [min]="0" [max]="1000" [step]="10" [(value)]="median" />
      <span
        >90th percentile lateness <span class="showcase-code">{{ percentile() }} ms</span></span
      >
      <neat-slider
        label="90th percentile lateness"
        [min]="0"
        [max]="4000"
        [step]="50"
        [(value)]="percentile"
      />
      <span
        >Video sync buffer <span class="showcase-code">{{ buffer() }} ms</span></span
      >
      <neat-slider
        label="Video sync buffer"
        [min]="0"
        [max]="4000"
        [step]="50"
        [value]="buffer()"
        (valueChange)="setBuffer($event)"
      />
    </div>
    <div class="showcase-row">
      <button neatSwitch [(checked)]="supported">The browser can set a buffer</button>
      <span class="showcase-code showcase-muted">Shared buffer: {{ followed() }} ms</span>
    </div>
    @if (held() !== null) {
      <p class="showcase-muted">Warning held off for {{ held() }} ms: the buffer changed.</p>
    } @else if (warning()) {
      @let notice = details();
      <neat-callout tone="warning" heading="Metadata is late" region>
        The metadata arrives {{ notice.latenessMs }} ms late for {{ notice.latePercent }}% of its
        messages, with a {{ notice.bufferMs }} ms buffer.
        @if (notice.suggestedBufferMs !== null) {
          A buffer of {{ notice.suggestedBufferMs }} ms would cover nine in ten of them.
        }
        @if (notice.blockedBy; as why) {
          {{ blocked[why] }}
        }
        @if (notice.suggestedBufferMs !== null) {
          <button
            neatButton
            neatCalloutActions
            type="button"
            size="small"
            (click)="setBuffer(notice.suggestedBufferMs)"
          >
            Use {{ notice.suggestedBufferMs }} ms
          </button>
        }
        @if (notice.globalAction; as action) {
          <button
            neatButton
            neatCalloutActions
            type="button"
            size="small"
            variant="outlined"
            (click)="applyShared(action)"
          >
            {{ action.kind === 'raise' ? 'Raise the shared buffer to' : 'Follow the shared' }}
            {{ action.valueMs }} ms
          </button>
        }
      </neat-callout>
    } @else {
      <p class="showcase-muted">No warning.</p>
    }
  `,
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
