import { computed, DOCUMENT, inject, Signal } from '@angular/core';
import { ThemeService } from '@sima/neat-ui';

/**
 * The values the kit stylesheet gives the theme variables `names` (without `--`) in the active
 * colour scheme, read back from the page and read again when the scheme changes. Reading the
 * rendered values shows what the kit ships, not a copy of how the theme computes them.
 */
export function injectThemeVariables(names: readonly string[]): Signal<Record<string, string>> {
  const root = inject(DOCUMENT).documentElement;
  const theme = inject(ThemeService);
  return computed(() => {
    theme.scheme();
    const style = getComputedStyle(root);
    return Object.fromEntries(
      names.map((name) => [name, style.getPropertyValue(`--${name}`).trim()]),
    );
  });
}
