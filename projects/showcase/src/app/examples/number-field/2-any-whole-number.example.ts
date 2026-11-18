import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

/** A field without `accept`: type 0 or 4096 and it commits, as any whole number does. */
@Component({
  selector: 'app-any-whole-number',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './2-any-whole-number.example.html',
  styleUrl: './stack.css',
})
export class AnyWholeNumber {
  protected readonly channel = signal(2);
}
