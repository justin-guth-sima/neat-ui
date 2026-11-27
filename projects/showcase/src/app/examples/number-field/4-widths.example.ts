import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatNumberField } from '@sima/neat-ui/number-field';

/**
 * By default a number field fills its container, as every field does: its box takes the room its
 * label leaves, the number and its unit in the middle between − and +. With `width="content"` the
 * box is as wide as the number and its unit, for a field in a toolbar or beside a heading.
 */
@Component({
  selector: 'app-widths',
  imports: [NeatNumberField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-widths.example.html',
  styleUrl: './stack.css',
})
export class Widths {
  protected readonly front = signal(30);
  protected readonly rear = signal(15);
}
