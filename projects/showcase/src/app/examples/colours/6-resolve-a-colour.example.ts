import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { neatResolveColor } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * Any one CSS colour as red, green and blue from 0 to 1, resolved by `neatResolveColor`: hex,
 * `rgb()`, `oklch()` or a colour's name. It answers null for text that is no colour, and where the
 * browser has no canvas to resolve it on.
 */
@Component({
  selector: 'app-resolve-a-colour',
  imports: [NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="field">
      <span>CSS colour</span>
      <input neatInput #css [value]="text()" (input)="text.set(css.value)" />
    </label>
    <div class="showcase-row">
      <span class="swatch" [style.background]="text()"></span>
      <span class="showcase-code">{{ result() }}</span>
    </div>
  `,
  styleUrl: './colour-fields.css',
})
export class ResolveAColour {
  protected readonly text = signal('oklch(0.7 0.15 250)');
  protected readonly result = computed(() => {
    const rgb = neatResolveColor(this.text());
    return rgb ? rgb.map((channel) => channel.toFixed(3)).join(', ') : 'not a colour';
  });
}
