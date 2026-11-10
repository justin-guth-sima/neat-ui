import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { contrastRatio, SIMA_PALETTE } from '@sima/neat-ui';
import { NeatInput } from '@sima/neat-ui/input';

const HEX = /^#[0-9a-f]{6}$/i;
/** WCAG 2.x AA for normal text. */
const AA = 4.5;

/**
 * The WCAG 2.x contrast ratio of two colors, from `contrastRatio`, in either order. It takes
 * `#RRGGBB` only and throws on anything else, so the field asks for that form first. AA for
 * normal text is 4.5:1.
 */
@Component({
  selector: 'app-contrast',
  imports: [NeatInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="showcase-row">
      <label class="field">
        <span>Text</span>
        <input neatInput #text [value]="foreground()" (input)="foreground.set(text.value)" />
      </label>
      <label class="field">
        <span>Background</span>
        <input neatInput #fill [value]="background()" (input)="background.set(fill.value)" />
      </label>
    </div>
    <div class="showcase-row">
      <span class="sample" [style.color]="foreground()" [style.background]="background()">
        Neat Insight
      </span>
      <span class="showcase-code">{{ result() }}</span>
    </div>
  `,
  styleUrls: ['./color-field.css', './contrast.example.css'],
})
export class Contrast {
  protected readonly foreground = signal<string>(SIMA_PALETTE.text);
  protected readonly background = signal<string>(SIMA_PALETTE.backgroundAlt);
  protected readonly result = computed(() => {
    const [foreground, background] = [this.foreground(), this.background()];
    if (!HEX.test(foreground) || !HEX.test(background)) return 'Both colors as #RRGGBB.';
    const ratio = contrastRatio(foreground, background);
    return `${ratio.toFixed(2)}:1 ${ratio >= AA ? 'AA' : 'below AA'}`;
  });
}
