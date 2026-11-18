import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

const REGIONS = ['Inclusion 1', 'Exclusion 1', 'Exclusion 2'];

/**
 * The regions of a channel, each with a Delete at the end of its line. Delete one to see the list
 * shrink; with none left a note takes its place, and Restore regions brings them back.
 *
 * @gallery
 */
@Component({
  selector: 'app-regions',
  imports: [NeatButton, NeatInlineButton, NeatLine, NeatLineEnd, NeatLineList, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-regions.example.html',
  styleUrl: './regions.example.css',
})
export class Regions {
  protected readonly all = REGIONS;
  protected readonly regions = signal(REGIONS);

  protected remove(region: string): void {
    this.regions.update((regions) => regions.filter((name) => name !== region));
  }
}
