import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

/**
 * A frame rate stepped by 5 down to 1, with its unit inside the field and its heading as its only
 * visible name. Press + or −, or ArrowUp and ArrowDown in the field, and the rate commits at
 * once. At 1, − is off. Type 0 and the field is marked invalid until Enter puts the rate back.
 */
@Component({
  selector: 'app-steps-and-a-unit',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './3-steps-and-a-unit.example.html',
  styleUrls: ['./stack.css', './heading.css'],
})
export class StepsAndAUnit {
  protected readonly rate = signal(16);
}
