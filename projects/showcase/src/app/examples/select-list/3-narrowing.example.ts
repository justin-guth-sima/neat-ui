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
  templateUrl: './3-narrowing.example.html',
  styleUrls: ['./channels-box.css', './narrowing.example.css', './stack.css'],
})
export class Narrowing {
  protected readonly channels = CHANNELS;
  protected readonly channelId = channelId;
  protected readonly narrow = signal(false);
}
