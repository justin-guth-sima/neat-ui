import { PANEL_SURFACE_CLASSES } from '../overlay/panel-surface';
import { READOUT_CLASSES } from './readout-classes';

/** The classes without a variant, the ones that hold in every state. */
const plain = (classes: string) => classes.split(' ').filter((name) => !name.includes(':'));

describe('READOUT_CLASSES', () => {
  it('draws the box in the popover’s surface: its fill, text color, radius, shadow and outline', () => {
    // A family of utilities and what tells its classes apart from another family's.
    const FAMILIES: Record<string, RegExp> = {
      fill: /^bg-/,
      'text color': /^text-popover/,
      radius: /^rounded(-|$)/,
      shadow: /^shadow(-|$)/,
      'outline width': /^ring(-\d+)?$/,
      'outline color': /^ring-(?!\d+$)/,
    };
    const box = plain(READOUT_CLASSES.box);
    const surface = plain(PANEL_SURFACE_CLASSES);
    for (const [family, pattern] of Object.entries(FAMILIES)) {
      const surfaceClasses = surface.filter((name) => pattern.test(name));
      expect(surfaceClasses.length, family).toBeGreaterThan(0);
      expect(
        box.filter((name) => pattern.test(name)),
        family,
      ).toEqual(surfaceClasses);
    }
  });
});
