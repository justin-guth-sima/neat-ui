import helmField from '../ui/field/src/lib/hlm-field.ts?source' with { loader: 'text' };
import helmLabel from '../ui/label/src/lib/hlm-label.ts?source' with { loader: 'text' };
import {
  classSet,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
} from '../typography/helm-classes.testing';
import { FIELD_LABEL_CLASSES } from './field-label';

const list = (classes: string) => classes.split(' ');

describe('the field label classes', () => {
  it('helm drift: the name is helm’s label, class for class', () => {
    expect(classSet(list(FIELD_LABEL_CLASSES.label))).toEqual(classSet(helmHostClasses(helmLabel)));
  });

  it('helm drift: the stack is a column in helm’s vertical field gap', () => {
    expect(helmCvaBase(helmField)).toContain('gap-3');
    expect(helmCvaVariant(helmField, 'vertical')).toContain('flex-col');
    expect(classSet(list(FIELD_LABEL_CLASSES.stack))).toEqual(['flex', 'flex-col', 'gap-3']);
  });
});
