import { contrastRatio, hexToOklch, isInSrgbGamut, oklchToHex, relativeLuminance } from './color';
import { SIMA_PALETTE } from './palette';

describe('contrastRatio', () => {
  it('matches the WCAG ratios of the palette text and orange on white', () => {
    expect(contrastRatio('#010F0E', '#FFFFFF')).toBeCloseTo(19.5, 1);
    expect(contrastRatio('#D26728', '#FFFFFF')).toBeCloseTo(3.7, 1);
  });

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#FFFFFF', '#D26728')).toBe(contrastRatio('#D26728', '#FFFFFF'));
  });

  it('spans 1:1 for identical colours to 21:1 for black on white', () => {
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

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });
});

describe('OKLCH conversion', () => {
  it('round-trips every palette colour exactly, as upper-case #RRGGBB', () => {
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

  it('tells sRGB colours from out-of-gamut ones', () => {
    expect(isInSrgbGamut(hexToOklch(SIMA_PALETTE.orange))).toBe(true);
    expect(isInSrgbGamut({ l: 0.9, c: 0.3, h: 40 })).toBe(false);
  });
});
