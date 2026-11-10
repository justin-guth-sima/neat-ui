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
  template: `
    <neat-card>
      <div class="frame">
        <img
          class="picture"
          alt="A gray frame with a lighter square in its middle"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 90' preserveAspectRatio='xMidYMid slice'%3E%3Crect width='160' height='90' fill='%23888'/%3E%3Crect x='60' y='25' width='40' height='40' fill='%23ccc'/%3E%3C/svg%3E"
        />
      </div>
    </neat-card>
    <neat-card title="Camera 1" subtitle="Front door">
      <p>Last detection: person, 0.92.</p>
      <p>Two more in the last minute, one of them a car.</p>
      <p>Nothing since.</p>
      <p neatCardFooter>Updated just now</p>
    </neat-card>
  `,
  styleUrl: './filling-the-row.example.css',
})
export class FillingTheRowExample {}
