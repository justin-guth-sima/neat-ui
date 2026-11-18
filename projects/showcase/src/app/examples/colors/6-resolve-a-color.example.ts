import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { neatResolveColor } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

/**
 * Any one CSS color as red, green and blue from 0 to 1, resolved by `neatResolveColor`: hex,
 * `rgb()`, `oklch()` or a color's name. It answers null for text that is no color, and where the
 * browser has no canvas to resolve it on.
 */
@Component({
  selector: 'app-resolve-a-color',
  imports: [NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './6-resolve-a-color.example.html',
  styleUrls: ['./color-field.css', './resolve-a-color.example.css'],
})
export class ResolveAColor {
  protected readonly text = signal('oklch(0.7 0.15 250)');
  protected readonly result = computed(() => {
    const rgb = neatResolveColor(this.text());
    return rgb ? rgb.map((channel) => channel.toFixed(3)).join(', ') : 'not a color';
  });
}
