import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSelect } from '@sima/neat-ui/select';
import { SOURCES } from './sources';

/**
 * Four selects over one list: the label shown above, the label hidden (it still names the select),
 * the label inline before the select, and a disabled select. The first three share one value, so a
 * pick in any of them shows in the others and in the line below.
 *
 * @capture click neat-select:first-of-type button
 * @gallery
 */
@Component({
  selector: 'app-label-positions',
  imports: [NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="selects">
      <neat-select
        label="Source"
        placeholder="Pick a source"
        showLabel
        [options]="sources"
        [(value)]="source"
      />
      <neat-select
        label="Source, label hidden"
        placeholder="Pick a source"
        [options]="sources"
        [(value)]="source"
      />
      <neat-select
        label="Source"
        placeholder="Pick a source"
        labelPosition="inline"
        [options]="sources"
        [(value)]="source"
      />
      <neat-select label="Disabled" disabled [options]="sources" [value]="'rtsp'" />
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Selected: {{ source() ?? 'none' }}
    </p>
  `,
  styleUrls: ['./stack.css', './label-positions.example.css'],
})
export class LabelPositions {
  protected readonly sources = SOURCES;
  protected readonly source = signal<string | null>(null);
}
