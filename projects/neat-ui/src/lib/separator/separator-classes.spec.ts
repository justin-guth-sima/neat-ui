import helmSeparator from '../ui/separator/src/lib/hlm-separator.ts?source' with { loader: 'text' };
import { SEPARATOR_CLASSES } from './separator-classes';

describe('SEPARATOR_CLASSES', () => {
  it('helm drift: every copied class string still appears in the vendored helm separator', () => {
    for (const part of Object.values(SEPARATOR_CLASSES)) {
      expect(helmSeparator).toContain(part);
    }
  });
});
