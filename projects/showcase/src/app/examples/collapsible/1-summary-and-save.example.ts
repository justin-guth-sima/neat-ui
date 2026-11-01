import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCollapsible } from '@sima/neat-ui/collapsible';
import { NeatDetails } from '@sima/neat-ui/details';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * Two sections. Details says what it holds while it is closed. Open Change board and press Save:
 * the section closes and the focus is on its button, not lost to the page.
 */
@Component({
  selector: 'app-summary-and-save',
  imports: [NeatButton, NeatCollapsible, NeatDetails, NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel">
      <neat-collapsible label="Details" summary="IMX219 · MIPI CSI · NV12">
        <dl neatDetails>
          <dt>Model</dt>
          <dd>IMX219</dd>
          <dt>Receiver</dt>
          <dd><code>imx219 1-0010</code></dd>
        </dl>
      </neat-collapsible>
      <neat-collapsible label="Change board" [(open)]="boardOpen">
        <div class="showcase-row">
          <input neatInput type="text" value="192.168.1.20" aria-label="Board address" />
          <button neatButton type="button" (click)="boardOpen.set(false)">Save</button>
        </div>
      </neat-collapsible>
    </div>
  `,
  styleUrl: './panel.css',
})
export class SummaryAndSave {
  protected readonly boardOpen = signal(false);
}
