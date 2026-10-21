import {
  EnvironmentProviders,
  inject,
  makeEnvironmentProviders,
  provideEnvironmentInitializer,
} from '@angular/core';
import { providePrimeNG } from 'primeng/config';
import { NeatPreset } from './neat-preset';
import { NEAT_DARK_CLASS, ThemeService } from './theme.service';

/**
 * Everything an app needs from the kit, in one call: the SiMa PrimeNG preset (PrimeNG in its own
 * `primeng` cascade layer, so unlayered kit and app styles win without heavier selectors) and the
 * stored colour scheme applied at start-up.
 */
export function provideNeatUi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    providePrimeNG({
      theme: {
        preset: NeatPreset,
        options: { darkModeSelector: `.${NEAT_DARK_CLASS}`, cssLayer: { name: 'primeng' } },
      },
    }),
    provideEnvironmentInitializer(() => inject(ThemeService)),
  ]);
}
