import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCallout } from '@sima/neat-ui/callout';

/** A banner as it stands over a page: a heading, a line of text and one action. */
@Component({
  selector: 'app-banner',
  imports: [NeatButton, NeatCallout],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-callout tone="warning" heading="Board changed" region>
      The board at 192.168.1.20 replaced the previous one. Devices are from the last scan.
      <button neatButton neatCalloutActions type="button" size="small">Refresh</button>
    </neat-callout>
  `,
})
export class Banner {}
