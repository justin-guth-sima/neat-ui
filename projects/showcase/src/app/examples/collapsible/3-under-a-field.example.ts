import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatInlineButton } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatInput } from '@sima/neat-ui/input';
import { NeatLine, NeatLineEnd, NeatLineList } from '@sima/neat-ui/line-list';

/**
 * A note under a field that opens into what it says: the note variant, with a warning dot. The
 * field's `aria-describedby` names the note's trigger, so a screen reader reads "Overridden on 2
 * channels" when the field gets the focus.
 *
 * Open it and choose Use global on a channel. The last one takes the note away.
 */
@Component({
  selector: 'app-under-a-field',
  imports: [NeatCollapsible, NeatInlineButton, NeatInput, NeatLine, NeatLineEnd, NeatLineList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-under-a-field.example.html',
  styleUrl: './panel.css',
})
export class UnderAField {
  protected readonly open = signal(false);
  protected readonly channels = signal([
    { name: 'Channel 3', value: '900 ms' },
    { name: 'Channel 7', value: '600 ms' },
  ]);

  protected useGlobal(name: string): void {
    this.channels.update((channels) => channels.filter((channel) => channel.name !== name));
  }
}
