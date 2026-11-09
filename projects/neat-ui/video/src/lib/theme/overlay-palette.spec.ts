import { NEAT_DANGER_BASE, SIMA_PALETTE } from '@sima/neat-ui';
import { OVERLAY_ROI_COLORS } from './overlay-palette';

describe('overlay palette', () => {
  it('draws ROI polygons in the kit green (inclusion) and danger red (exclusion)', () => {
    expect(OVERLAY_ROI_COLORS.inclusion.stroke).toBe(SIMA_PALETTE.green);
    expect(OVERLAY_ROI_COLORS.exclusion.stroke).toBe(NEAT_DANGER_BASE);
  });

  it('gives each ROI type a highlight fill of its own hue, stronger than its resting fill', () => {
    const rgba = (color: string) => {
      const match = /^(#[0-9a-f]{6})([0-9a-f]{2})$/i.exec(color);
      if (match === null) throw new Error(`${color} is not #rrggbbaa`);
      return { rgb: match[1].toLowerCase(), alpha: Number.parseInt(match[2], 16) / 255 };
    };
    for (const type of ['inclusion', 'exclusion'] as const) {
      const fill = rgba(OVERLAY_ROI_COLORS[type].fill);
      const active = rgba(OVERLAY_ROI_COLORS[type].fillActive);
      expect(fill.rgb, type).toBe(OVERLAY_ROI_COLORS[type].stroke.toLowerCase());
      expect(active.rgb, type).toBe(fill.rgb);
      // Enough to tell apart at a glance, still see-through so the video under it stays visible.
      expect(active.alpha, type).toBeGreaterThanOrEqual(fill.alpha * 2);
      expect(active.alpha, type).toBeLessThanOrEqual(0.4);
    }
  });
});
