import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton, NeatIcon } from '@sima/neat-ui';

/**
 * The action that starts something and the one that stops it: `success` with a filled `play`
 * icon, `danger` with a filled `stop` icon, the icon before the label at 16 px.
 */
@Component({
  selector: 'app-start-and-stop',
  imports: [NeatButton, NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatButton type="button" variant="success">
        <neat-icon name="play" [size]="16" />
        Start
      </button>
      <button neatButton type="button" variant="danger">
        <neat-icon name="stop" [size]="16" />
        Stop
      </button>
    </div>
  `,
})
export class StartAndStop {}
