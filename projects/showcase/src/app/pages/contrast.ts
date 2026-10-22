import { contrastRatio } from '@sima/neat-ui';

/** WCAG 2.x AA for normal text. */
const AA = 4.5;
const HEX = /^#[0-9a-f]{6}$/i;

/** A contrast ratio as shown on the page: two decimals and whether it reaches AA. */
export function describeRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1 ${ratio >= AA ? 'AA' : 'below AA'}`;
}

/**
 * The contrast between two theme variable values, described; empty unless both are `#rrggbb`
 * (the kit stylesheet's form), as when no stylesheet is loaded.
 */
export function describeContrast(foreground: string, background: string): string {
  return HEX.test(foreground) && HEX.test(background)
    ? describeRatio(contrastRatio(foreground, background))
    : '';
}
