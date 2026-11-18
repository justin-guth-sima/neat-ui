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
  rgb ? rgb.map((channel) => channel.toFixed(3)).join(', ') : 'not a color';

/**
 * Six tokens as the numbers `neatThemeColors` answers, each red, green and blue from 0 to 1, as
 * code that draws outside CSS takes a color. The signal reads them again when the scheme changes:
 * switch the theme at the bottom of the rail and the numbers follow.
 */
@Component({
  selector: 'app-theme-colors-as-numbers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './5-theme-colors-as-numbers.example.html',
  styleUrl: './theme-colors-as-numbers.example.css',
})
export class ThemeColorsAsNumbers {
  private readonly colors = neatThemeColors(TOKENS);
  protected readonly rows = computed(() => {
    const colors = this.colors();
    return Object.entries(TOKENS).map(([name, token]) => ({
      token,
      rgb: format(colors[name as keyof typeof TOKENS]),
    }));
  });
}
