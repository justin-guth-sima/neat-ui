import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { type Channel, channelId } from './channels';

/** A list with no items: `emptyLabel` says why there are no rows. */
@Component({
  selector: 'app-no-items',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <neat-select-list
        label="Cameras"
        emptyLabel="No cameras enabled yet."
        [items]="none"
        [trackBy]="channelId"
      >
        <ng-template neatColumn="name" let-channel>{{ channel.name }}</ng-template>
      </neat-select-list>
    </div>
  `,
  styleUrl: './no-items.example.css',
})
export class NoItems {
  protected readonly none: readonly Channel[] = [];
  protected readonly channelId = channelId;
}
