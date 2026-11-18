import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';

/**
 * Two cards in a row of equal height.
 *
 * The content takes the height the card has left. So the untitled card gives its image all of it,
 * and a footer stands at the bottom of its card however little there is above it.
 *
 * @gallery
 */
@Component({
  selector: 'app-filling-the-row',
  imports: [NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-filling-the-row.example.html',
  styleUrl: './filling-the-row.example.css',
})
export class FillingTheRowExample {}
