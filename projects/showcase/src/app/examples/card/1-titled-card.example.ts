import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatButton } from '@sima/neat-ui';
import { NeatCard } from '@sima/neat-ui/card';

/**
 * A card with a title, a subtitle, an action at the header's end and a footer. It is a landmark
 * too: `region` names it by its title, for a user who jumps between regions.
 */
@Component({
  selector: 'app-titled-card',
  imports: [NeatButton, NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-titled-card.example.html',
  styleUrl: './card.example.css',
})
export class TitledCardExample {}
