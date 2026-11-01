import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { type NeatRgb, neatThemeColors } from '@sima/neat-ui';

/** The tokens a WebGL or canvas drawing might take, named as the drawing names them. */
const TOKENS = {
  background: '--background',
  foreground: '--foreground',
  primary: '--primary',
  line: '--neat-line',
  series1: '--neat-series-1',
  success: '--success',
} as const;

const format = (rgb: NeatRgb | null): string =>
  rgb ? rgb.map((channel) => channel.toFixed(3)).join(', ') : 'not a colour';

/**
 * Six tokens as the numbers `neatThemeColors` answers, each red, green and blue from 0 to 1, as
 * code that draws outside CSS takes a colour. The signal reads them again when the scheme changes:
 * switch it in the top bar and the numbers follow.
 */
@Component({
  selector: 'app-theme-colours-as-numbers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table>
      <thead>
        <tr>
          <th scope="col">Token</th>
          <th scope="col">Sample</th>
          <th scope="col">Red, green, blue</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.token) {
          <tr>
            <th scope="row" class="showcase-code">{{ row.token }}</th>
            <td><span class="sample" [style.background]="'var(' + row.token + ')'"></span></td>
            <td class="showcase-code">{{ row.rgb }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './theme-colours-as-numbers.example.css',
})
export class ThemeColoursAsNumbers {
  private readonly colours = neatThemeColors(TOKENS);
  protected readonly rows = computed(() => {
    const colours = this.colours();
    return Object.entries(TOKENS).map(([name, token]) => ({
      token,
      rgb: format(colours[name as keyof typeof TOKENS]),
    }));
  });
}
