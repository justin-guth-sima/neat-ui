import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatCard } from '@sima/neat-ui/card';

/** A card with content only: no header, no landmark, and no space kept for either. */
@Component({
  selector: 'app-content-only-card',
  imports: [NeatCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-card>
      <p>yolov8n, 640 by 640.</p>
    </neat-card>
  `,
  styleUrl: './card.example.css',
})
export class ContentOnlyCardExample {}
