import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';

/** The labels of Insight's source switch, too wide together for a narrow side panel. */
const SOURCES: NeatSegmentedOption<string>[] = [
  { value: 'file', label: 'File' },
  { value: 'camera', label: 'Camera' },
  { value: 'url', label: 'Stream URL' },
];

/**
 * A container 16rem wide, the content width of a side panel at its narrowest: look at the clipped
 * "Stream URL".
 */
@Component({
  selector: 'app-in-a-narrow-panel',
  imports: [NeatSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <neat-segmented label="Source" [options]="sources" [(value)]="source" />
    </div>
  `,
  styleUrl: './in-a-narrow-panel.example.css',
})
export class InANarrowPanel {
  protected readonly sources = SOURCES;
  protected readonly source = signal('url');
}
