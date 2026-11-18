import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';

/** A card with content only: no header, no landmark, and no space kept for either. */
@Component({
  selector: 'app-content-only-card',
  imports: [NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-content-only.example.html',
  styleUrl: './card.example.css',
})
export class ContentOnlyCardExample {}
