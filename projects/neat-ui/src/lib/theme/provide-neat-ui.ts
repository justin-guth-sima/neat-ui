import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { ThemeService } from './theme.service';

/**
 * The kit's start-up in one call: it applies the stored color scheme before the first render.
 * The colors themselves come from the kit stylesheet (`@sima/neat-ui/styles/neat-ui.css`).
 */
export function provideNeatUi(): EnvironmentProviders {
  return makeEnvironmentProviders([provideEnvironmentInitializer(() => inject(ThemeService))]);
}
