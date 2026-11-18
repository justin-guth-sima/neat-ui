import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { type Channel, CHANNELS, channelId } from './channels';

/**
 * Channels in three columns, the last holding a button. Press Up or Down in the list to move the
 * selection, Enter or click a row to activate it. Start and Stop swap the row's object for a new
 * one, as a poll's answer would: the selection stays on its channel.
 */
@Component({
  selector: 'app-channels',
  imports: [NeatColumn, NeatInlineButton, NeatSelectList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-channels.example.html',
  styleUrls: ['./channels-box.css', './stack.css'],
})
export class Channels {
  protected readonly channels = signal<readonly Channel[]>(CHANNELS);
  protected readonly selected = signal<Channel | null>(null);
  protected readonly log = signal('nothing activated yet');
  protected readonly channelId = channelId;

  protected toggle(channel: Channel): void {
    const state = channel.state === 'Live' ? 'Idle' : 'Live';
    this.channels.update((channels) =>
      channels.map((candidate) =>
        candidate.id === channel.id ? { ...candidate, state } : candidate,
      ),
    );
  }
}
