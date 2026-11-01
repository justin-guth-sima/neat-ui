import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton, NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

const REGIONS = ['Inclusion 1', 'Exclusion 1', 'Exclusion 2'];

/**
 * The regions of a channel, each with a Delete at the end of its line. Delete one to see the list
 * shrink; with none left a note takes its place, and Restore regions brings them back.
 */
@Component({
  selector: 'app-regions',
  imports: [NeatButton, NeatInlineButton, NeatLine, NeatLineEnd, NeatLineList, NeatNote],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="list">
      @if (regions().length === 0) {
        <p neatNote>No regions.</p>
      } @else {
        <ul neatLineList>
          @for (region of regions(); track region) {
            <li neatLine>
              <span>{{ region }}</span>
              <button
                neatInlineButton
                neatLineEnd
                type="button"
                [attr.aria-label]="'Delete ' + region"
                (click)="remove(region)"
              >
                Delete
              </button>
            </li>
          }
        </ul>
      }
    </div>
    <div class="showcase-row">
      <button neatButton type="button" variant="outlined" size="small" (click)="regions.set(all)">
        Restore regions
      </button>
    </div>
  `,
  styleUrl: './regions.example.css',
})
export class Regions {
  protected readonly all = REGIONS;
  protected readonly regions = signal(REGIONS);

  protected remove(region: string): void {
    this.regions.update((regions) => regions.filter((name) => name !== region));
  }
}
