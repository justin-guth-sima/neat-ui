import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatStatusChip, NeatStatusChipButton } from '@sima/neat-ui/status-chip';
import { CHIPS, SURFACES } from './chips';

/**
 * `variant="tinted"` puts each tone's color on a tint of itself, for chips that label the parts
 * of a card, as a diagram block's do. `neutral` is the same gray as in the solid variant. A tinted
 * chip belongs on the page or a card, as here, and not on a toned list row.
 */
@Component({
  selector: 'app-tinted',
  imports: [NeatStatusChip, NeatStatusChipButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-tinted.example.html',
  styleUrl: './surfaces.css',
})
export class Tinted {
  protected readonly surfaces = SURFACES;
  protected readonly chips = CHIPS;
}
