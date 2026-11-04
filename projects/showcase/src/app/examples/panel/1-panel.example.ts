import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatPanel } from '@sima/neat-ui/panel';

/** A panel with an action at its header's end, and one with none, whose header keeps no gap. */
@Component({
  selector: 'app-panel',
  imports: [NeatButton, NeatPanel],
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
  styleUrl: './panel.example.css',
})
export class PanelExample {}
