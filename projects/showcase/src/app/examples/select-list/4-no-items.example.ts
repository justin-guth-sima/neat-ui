import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { type Channel, channelId } from './channels';

/** A list with no items: `emptyLabel` says why there are no rows. */
@Component({
  selector: 'app-no-items',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-no-items.example.html',
  styleUrl: './no-items.example.css',
})
export class NoItems {
  protected readonly none: readonly Channel[] = [];
  protected readonly channelId = channelId;
}
