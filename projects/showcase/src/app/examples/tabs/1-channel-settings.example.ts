import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatTab, NeatTabs } from '@sima/neat-ui/tabs';

/**
 * Three tabs, the third disabled: the arrow keys wrap between the first two and skip it.
 *
 * @gallery
 */
@Component({
  selector: 'app-channel-settings',
  imports: [NeatTab, NeatTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-channel-settings.example.html',
})
export class ChannelSettings {
  protected readonly tab = signal('metadata');
}
