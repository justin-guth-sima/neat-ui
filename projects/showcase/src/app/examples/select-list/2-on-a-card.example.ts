import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { type Channel, CHANNELS, channelId } from './channels';

/**
 * The same list on a card. The card sets `--neat-surface` to its own fill, and the header that
 * stays put over the scrolling rows takes it. Try scrolling the list, and look at the header's
 * edge.
 */
@Component({
  selector: 'app-on-a-card',
  imports: [NeatColumn, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box wide card">
      <neat-select-list
        label="Channels on a card"
        [items]="channels"
        [trackBy]="channelId"
        [(selected)]="selected"
      >
        <ng-template neatColumn="name" header="Channel" let-channel>{{ channel.name }}</ng-template>
        <ng-template neatColumn="state" header="State" width="6rem" let-channel>{{
          channel.state
        }}</ng-template>
      </neat-select-list>
    </div>
  `,
  styleUrls: ['./channels-box.css', './on-a-card.example.css'],
})
export class OnACard {
  protected readonly channels = CHANNELS;
  protected readonly selected = signal<Channel | null>(null);
  protected readonly channelId = channelId;
}
