/** WCAG 2.x AA for normal text. */
const AA = 4.5;

/** A contrast ratio as shown on the page: two decimals and whether it reaches AA. */
export function describeRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1 ${ratio >= AA ? 'AA' : 'below AA'}`;
}

/** `#RRGGBB` from the colour string a browser computes for a sRGB colour, or undefined if it is anything else. */
export function computedToHex(value: string): string | undefined {
  const match = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (!match) {
    return undefined;
  }
  const channels = match
    .slice(1, 4)
    .map((channel) => Number(channel).toString(16).padStart(2, '0'));
  return `#${channels.join('').toUpperCase()}`;
}
