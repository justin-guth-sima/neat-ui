import helmItem from '../ui/breadcrumb/src/lib/hlm-breadcrumb-item.ts?source' with {
  loader: 'text',
};
import helmLink from '../ui/breadcrumb/src/lib/hlm-breadcrumb-link.ts?source' with {
  loader: 'text',
};
import helmList from '../ui/breadcrumb/src/lib/hlm-breadcrumb-list.ts?source' with {
  loader: 'text',
};
import helmPage from '../ui/breadcrumb/src/lib/hlm-breadcrumb-page.ts?source' with {
  loader: 'text',
};
import helmSeparator from '../ui/breadcrumb/src/lib/hlm-breadcrumb-separator.ts?source' with {
  loader: 'text',
};
import { classSet, helmHostClasses } from '../typography/helm-classes.testing';
import { BREADCRUMB_HELM_CLASSES } from './breadcrumb-classes';

describe('BREADCRUMB_HELM_CLASSES', () => {
  it('helm drift: each part is its vendored helm part’s classes, class for class', () => {
    const cases: [string, string][] = [
      [BREADCRUMB_HELM_CLASSES.list, helmList],
      [BREADCRUMB_HELM_CLASSES.item, helmItem],
      [BREADCRUMB_HELM_CLASSES.link, helmLink],
      [BREADCRUMB_HELM_CLASSES.page, helmPage],
      [BREADCRUMB_HELM_CLASSES.separator, helmSeparator],
    ];
    for (const [copied, helm] of cases) {
      expect(classSet(copied.split(' ')), copied).toEqual(classSet(helmHostClasses(helm)));
    }
  });
});
