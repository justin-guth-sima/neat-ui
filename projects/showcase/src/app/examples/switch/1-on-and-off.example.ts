import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NeatSwitch } from '@sima/neat-ui/switch';

/**
 * Two switches with a label, and a third without content, which takes an `aria-label`. The third
 * shares its value with the first: try toggling either. Last come two disabled ones, off and on.
 *
 * @gallery
 */
@Component({
  selector: 'app-on-and-off',
  imports: [NeatSwitch],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <button neatSwitch [(checked)]="bars">Bars</button>
      <button neatSwitch [(checked)]="hideEmpty">Hide empty</button>
      <button neatSwitch aria-label="Bars, without a visible label" [(checked)]="bars"></button>
      <button neatSwitch disabled>Disabled</button>
      <button neatSwitch disabled [checked]="true">Disabled, on</button>
    </div>
    <p class="showcase-code showcase-muted">
      Bars {{ bars() ? 'on' : 'off' }}, hide empty {{ hideEmpty() ? 'on' : 'off' }}
    </p>
  `,
  styleUrl: './on-and-off.example.css',
})
export class OnAndOff {
  protected readonly bars = signal(true);
  protected readonly hideEmpty = signal(false);
}
