import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatSegmented, type NeatSegmentedOption } from '@sima/neat-ui/segmented';

const VIEWS: NeatSegmentedOption<string>[] = [
  { value: 'live', label: 'Live' },
  { value: 'runs', label: 'Runs' },
];

/** A 13rem row, as a crowded toolbar is, with a long title beside the control. */
@Component({
  selector: 'app-in-a-crowded-row',
  imports: [NeatSegmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="crowded">
      <neat-segmented label="Stats view" [options]="views" value="live" />
      <span class="title">Stats for a stream with a long name</span>
    </div>
  `,
  styleUrl: './in-a-crowded-row.example.css',
})
export class InACrowdedRow {
  protected readonly views = VIEWS;
}
