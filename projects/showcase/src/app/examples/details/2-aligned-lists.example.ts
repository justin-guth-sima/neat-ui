import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatDetails } from '@sima/neat-ui/details';

/**
 * Two lists on one term column: `--neat-details-term-width` is set on their common ancestor. The
 * first list's longest term is wider than the column, so it breaks inside the word.
 */
@Component({
  selector: 'app-aligned-lists',
  imports: [NeatDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel lists">
      <dl neatDetails>
        <dt>Model</dt>
        <dd>IMX219</dd>
        <dt>Reconnect_attempts_since_boot</dt>
        <dd>3</dd>
      </dl>
      <dl neatDetails>
        <dt>Receiver</dt>
        <dd><code>imx219 1-0010</code></dd>
        <dt>Format</dt>
        <dd>NV12</dd>
      </dl>
    </div>
  `,
  styleUrls: ['./panel.css', './aligned-lists.example.css'],
})
export class AlignedLists {}
