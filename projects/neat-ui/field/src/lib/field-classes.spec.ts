import helmField from '../../../src/lib/ui/field/src/lib/hlm-field.ts?source' with {
  loader: 'text',
};
import helmFieldDescription from '../../../src/lib/ui/field/src/lib/hlm-field-description.ts?source' with {
  loader: 'text',
};
import helmFieldError from '../../../src/lib/ui/field/src/lib/hlm-field-error.ts?source' with {
  loader: 'text',
};
import {
  classSet,
  helmCvaBase,
  helmCvaVariant,
  helmHostClasses,
} from '../../../src/lib/typography/helm-classes.testing';
import { FIELD_HELM_CLASSES } from './field-classes';

const list = (...classes: readonly string[]) => classes.flatMap((part) => part.split(' '));

describe('FIELD_HELM_CLASSES', () => {
  it('helm drift: each part is its helm file’s classes, class for class', () => {
    const cases: [readonly string[], string[]][] = [
      [[FIELD_HELM_CLASSES.host], helmCvaBase(helmField)],
      [[FIELD_HELM_CLASSES.vertical], helmCvaVariant(helmField, 'vertical')],
      [FIELD_HELM_CLASSES.description, helmHostClasses(helmFieldDescription)],
      [[FIELD_HELM_CLASSES.error], helmHostClasses(helmFieldError)],
    ];
    for (const [copied, helm] of cases) {
      expect(classSet(list(...copied))).toEqual(classSet(helm));
    }
  });
});
