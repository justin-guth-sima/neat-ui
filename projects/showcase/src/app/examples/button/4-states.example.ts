import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatButton, NeatIcon } from '@sima/neat-ui';
import { VARIANTS } from './variants';

/**
 * Per variant: with a `neat-icon` before the label, `disabled`, waiting and as a link. Look at the
 * Waiting column: it is dimmed like Disabled, but Tab still reaches it and hover still works. The
 * link leads back to this page, so trying it goes nowhere.
 */
@Component({
  selector: 'app-states',
  imports: [NeatButton, NeatIcon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './4-states.example.html',
  styleUrl: './stack.css',
})
export class States {
  protected readonly variants = VARIANTS;
}
