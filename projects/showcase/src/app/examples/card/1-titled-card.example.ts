import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';

/**
 * A card with a title, a subtitle, an action at the header's end and a footer, and a landmark:
 * `region` names it by its title for a user who jumps between regions.
 */
@Component({
  selector: 'app-titled-card',
  imports: [NeatButton, NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-card title="Detections" subtitle="The last minute" region>
      <button neatButton neatCardActions type="button" size="small">Clear</button>
      <p>Nothing yet.</p>
      <p neatCardFooter>Updated just now</p>
    </neat-card>
  `,
  styleUrl: './card.example.css',
})
export class TitledCardExample {}
