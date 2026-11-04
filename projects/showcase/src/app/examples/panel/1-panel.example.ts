import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatPanel, NeatPanelActions } from '@sima/neat-ui/panel';

/** A panel with an action at its header's end, and one with none, whose header keeps no gap. */
@Component({
  selector: 'app-panel',
  imports: [NeatButton, NeatPanel, NeatPanelActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-panel heading="Detections">
      <button neatButton neatPanelActions type="button" size="small">Clear</button>
      <p>Nothing yet.</p>
    </neat-panel>
    <neat-panel heading="Model">
      <p>yolov8n, 640 by 640.</p>
    </neat-panel>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--neat-space-3);
    }
    p {
      margin: 0;
    }
  `,
})
export class PanelExample {}
