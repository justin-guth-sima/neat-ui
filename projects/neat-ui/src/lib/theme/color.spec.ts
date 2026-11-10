import {
  composite,
  contrastRatio,
  hexToOklch,
  hexToOklab,
  isInSrgbGamut,
  mixOklab,
  oklchToHex,
  relativeLuminance,
  withAlpha,
} from './color';
import { SIMA_PALETTE } from './palette';

describe('contrastRatio', () => {
  it('matches the WCAG ratios of the palette text and orange on white', () => {
    expect(contrastRatio('#010F0E', '#FFFFFF')).toBeCloseTo(19.5, 1);
    expect(contrastRatio('#D26728', '#FFFFFF')).toBeCloseTo(3.7, 1);
  });

  it('does not depend on the order of the colors', () => {
    expect(contrastRatio('#FFFFFF', '#D26728')).toBe(contrastRatio('#D26728', '#FFFFFF'));
  });

  it('spans 1:1 for identical colors to 21:1 for black on white', () => {
    expect(contrastRatio('#5998DD', '#5998DD')).toBe(1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 10);
  });

  it('accepts lower-case hex', () => {
    expect(contrastRatio('#d26728', '#ffffff')).toBe(contrastRatio('#D26728', '#FFFFFF'));
  });

  it('rejects anything but #RRGGBB', () => {
    expect(() => contrastRatio('#FFF', '#000000')).toThrow(/#RRGGBB/);
    expect(() => contrastRatio('{primary.500}', '#000000')).toThrow(/#RRGGBB/);
  });
});

describe('composite', () => {
  it('blends per channel in gamma-encoded sRGB, as browsers composite', () => {
    expect(composite('#FFFFFF', 0.5, '#000000')).toBe('#808080');
    expect(composite('#C8372D', 0.1, '#FFFFFF')).toBe('#FAEBEA');
  });

  it('returns the background at alpha 0 and the color at alpha 1', () => {
    expect(composite('#D26728', 0, '#0D1D1C')).toBe('#0D1D1C');
    expect(composite('#d26728', 1, '#0D1D1C')).toBe('#D26728');
  });
});

describe('mixOklab', () => {
  it('moves the background towards the color by the share, in OKLab', () => {
    const [l, a, b] = hexToOklab(mixOklab('#2A9C4F', 0.1, '#FFFFFF'));
    const green = hexToOklab('#2A9C4F');
    const white = hexToOklab('#FFFFFF');
    // Within one 8-bit step of the exact mix: the result is rounded to #RRGGBB.
    expect(l).toBeCloseTo(white[0] + (green[0] - white[0]) * 0.1, 2);
    expect(a).toBeCloseTo(white[1] + (green[1] - white[1]) * 0.1, 2);
    expect(b).toBeCloseTo(white[2] + (green[2] - white[2]) * 0.1, 2);
    // CSS `color-mix(in oklab, #2a9c4f 10%, #ffffff)` gives the same color.
    expect(mixOklab('#2A9C4F', 0.1, '#FFFFFF')).toBe('#EBF5ED');
  });

  it('returns the background at share 0 and the color at share 1', () => {
    expect(mixOklab('#d26728', 0, '#101010')).toBe('#101010');
    expect(mixOklab('#d26728', 1, '#101010')).toBe('#D26728');
  });

  it('rejects a share outside 0 to 1', () => {
    expect(() => mixOklab('#D26728', 1.2, '#FFFFFF')).toThrow(/share/);
    expect(() => mixOklab('#D26728', -0.1, '#FFFFFF')).toThrow(/share/);
  });
});

describe('withAlpha', () => {
  it('appends the alpha as a hex byte, giving #RRGGBBAA', () => {
    expect(withAlpha('#010F0E', 0.6)).toBe('#010F0E99');
    expect(withAlpha('#ffffff', 0)).toBe('#FFFFFF00');
    expect(withAlpha('#FFFFFF', 1)).toBe('#FFFFFFFF');
  });

  it('rejects an alpha outside 0 to 1 and anything but #RRGGBB', () => {
    expect(() => withAlpha('#FFFFFF', 1.5)).toThrow(/alpha/);
    expect(() => withAlpha('#FFFFFF', -0.1)).toThrow(/alpha/);
    expect(() => withAlpha('#FFF', 0.5)).toThrow(/#RRGGBB/);
  });
});

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });
});

describe('OKLCH conversion', () => {
  it('round-trips every palette color exactly, as upper-case #RRGGBB', () => {
    for (const color of Object.values(SIMA_PALETTE)) {
      expect(oklchToHex(hexToOklch(color))).toBe(color);
      expect(oklchToHex(hexToOklch(color.toLowerCase()))).toBe(color);
    }
  });

  it('places white at full lightness without chroma', () => {
    const white = hexToOklch('#FFFFFF');
    expect(white.l).toBeCloseTo(1, 4);
    expect(white.c).toBeCloseTo(0, 4);
  });

  it('tells sRGB colors from out-of-gamut ones', () => {
    expect(isInSrgbGamut(hexToOklch(SIMA_PALETTE.orange))).toBe(true);
    expect(isInSrgbGamut({ l: 0.9, c: 0.3, h: 40 })).toBe(false);
  });
});
