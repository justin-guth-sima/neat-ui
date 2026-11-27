import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatBadge, NeatBadgeButton } from '@sima/neat-ui/badge';
import { BADGES, SURFACES } from './badges';

/**
 * `variant="solid"` fills each badge with its tone's status color, for the rare badge that must
 * stand out, such as a video tile's notice over the picture, or a badge in a toned list row, whose
 * selected fill is the soft badge's tint. `neutral` is the same gray as in the soft variant.
 */
@Component({
  selector: 'app-solid',
  imports: [NeatBadge, NeatBadgeButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-solid.example.html',
  styleUrl: './surfaces.css',
})
export class Solid {
  protected readonly surfaces = SURFACES;
  protected readonly badges = BADGES;
}
