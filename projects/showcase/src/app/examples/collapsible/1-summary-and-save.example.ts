import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatDetails } from '@sima/neat-ui/details';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * Two sections. Details says what it holds while it is closed. Open Change board and press Save:
 * the section closes and the focus is on its button, not lost to the page.
 *
 * @animated
 * @play click neat-collapsible:nth-of-type(1) [data-slot=collapsible-trigger]
 * @play click neat-collapsible:nth-of-type(2) [data-slot=collapsible-trigger]
 * @play wait 800
 */
@Component({
  selector: 'app-summary-and-save',
  imports: [NeatButton, NeatCollapsible, NeatDetails, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-summary-and-save.example.html',
  styleUrl: './panel.css',
})
export class SummaryAndSave {
  protected readonly boardOpen = signal(false);
}
