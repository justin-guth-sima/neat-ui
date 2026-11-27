import helmField from '../ui/field/src/lib/hlm-field.ts?source' with { loader: 'text' };
import helmFieldDescription from '../ui/field/src/lib/hlm-field-description.ts?source' with {
  loader: 'text',
};
import helmFieldError from '../ui/field/src/lib/hlm-field-error.ts?source' with { loader: 'text' };
import helmLabel from '../ui/label/src/lib/hlm-label.ts?source' with { loader: 'text' };
import { FIELD_CLASSES, FIELD_LABEL_CLASSES } from './field-label';

describe('the field classes', () => {
  it('helm drift: every copied class string still appears in the vendored helm files', () => {
    expect(helmField).toContain(FIELD_CLASSES.host);
    expect(helmField).toContain(FIELD_CLASSES.vertical);
    expect(helmLabel).toContain(FIELD_CLASSES.label);
    for (const part of FIELD_CLASSES.description) expect(helmFieldDescription).toContain(part);
    expect(helmFieldError).toContain(FIELD_CLASSES.error);
  });

  it('the label shared with the select is helm’s label, in helm’s vertical gap', () => {
    expect(FIELD_LABEL_CLASSES.label).toBe(FIELD_CLASSES.label);
    expect(FIELD_LABEL_CLASSES.stack).toBe('flex flex-col gap-3');
  });
});
