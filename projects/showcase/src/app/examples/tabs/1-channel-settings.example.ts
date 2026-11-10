import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';

/**
 * Three tabs, the third disabled: the arrow keys wrap between the first two and skip it.
 *
 * @gallery
 */
@Component({
  selector: 'app-channel-settings',
  imports: [NeatTab, NeatTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-tabs label="Channel settings" [(value)]="tab">
      <neat-tab label="Metadata" value="metadata">
        <ng-template>
          <p class="showcase-muted">Overlay types, confidence thresholds and tracking.</p>
        </ng-template>
      </neat-tab>
      <neat-tab label="General" value="general">
        <ng-template>
          <p class="showcase-muted">Video sync buffer, metadata retention and line width.</p>
        </ng-template>
      </neat-tab>
      <neat-tab label="ROI" value="roi" disabled>
        <ng-template><p class="showcase-muted">Regions of interest.</p></ng-template>
      </neat-tab>
    </neat-tabs>
  `,
})
export class ChannelSettings {
  protected readonly tab = signal('metadata');
}
