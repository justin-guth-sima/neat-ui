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
  template: `
    <div class="box wide">
      <neat-select-list
        label="Channels"
        [items]="channels()"
        [trackBy]="channelId"
        [(selected)]="selected"
        (activated)="log.set('Activated ' + $event.name)"
      >
        <ng-template neatColumn="name" header="Channel" let-channel>{{ channel.name }}</ng-template>
        <ng-template neatColumn="state" header="State" width="6rem" let-channel>{{
          channel.state
        }}</ng-template>
        <ng-template neatColumn="action" width="4rem" let-channel>
          <button neatInlineButton type="button" (click)="toggle(channel)">
            {{ channel.state === 'Live' ? 'Stop' : 'Start' }}
          </button>
        </ng-template>
      </neat-select-list>
    </div>
    <p class="showcase-code showcase-muted" aria-live="polite">
      Selected: {{ selected()?.name ?? 'none' }}; {{ log() }}
    </p>
  `,
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
