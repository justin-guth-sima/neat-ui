import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSelect } from '@sima/neat-ui/select';
import { SOURCES } from './sources';

/**
 * Four selects over one list: - the label shown above; - the label hidden, though it still names
 * the select; - the label inline, before the select; - a disabled select.
 *
 * The first three share one value. So a pick in any of them shows in the others and in the line
 * below.
 *
 * @capture click neat-select:first-of-type button
 * @gallery
 */
@Component({
  selector: 'app-label-positions',
  imports: [NeatSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-label-positions.example.html',
  styleUrls: ['./stack.css', './label-positions.example.css'],
})
export class LabelPositions {
  protected readonly sources = SOURCES;
  protected readonly source = signal<string | null>(null);
}
