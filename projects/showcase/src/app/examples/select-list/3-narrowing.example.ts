import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatColumn, NeatSelectList } from '@sima/neat-ui/select-list';
import { NeatSwitch } from '@sima/neat-ui/switch';
import { CHANNELS, channelId } from './channels';

/**
 * A list whose Rate column leaves below 300 px (`hideBelow`). Narrow the list with the switch and
 * the column goes; widen it and it returns.
 */
@Component({
  selector: 'app-narrowing',
  imports: [NeatColumn, NeatSelectList, NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box" [class.wide]="!narrow()" [class.slim]="narrow()">
      <neat-select-list label="Channels, narrowing" [items]="channels" [trackBy]="channelId">
        <ng-template neatColumn="name" header="Channel" let-channel>{{ channel.name }}</ng-template>
        <ng-template neatColumn="rate" header="Rate" width="4rem" [hideBelow]="300">30</ng-template>
        <ng-template neatColumn="state" header="State" width="5rem" let-channel>{{
          channel.state
        }}</ng-template>
      </neat-select-list>
    </div>
    <div class="showcase-row">
      <button neatSwitch [(checked)]="narrow">Narrow the list</button>
    </div>
  `,
  styleUrls: ['./channels-box.css', './narrowing.example.css', './stack.css'],
})
export class Narrowing {
  protected readonly channels = CHANNELS;
  protected readonly channelId = channelId;
  protected readonly narrow = signal(false);
}
