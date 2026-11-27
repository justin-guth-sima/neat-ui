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
import { BREADCRUMB_CLASSES } from './breadcrumb-classes';

describe('BREADCRUMB_CLASSES', () => {
  it('helm drift: every copied class string still appears in its vendored helm part', () => {
    expect(helmList).toContain(BREADCRUMB_CLASSES.list);
    expect(helmItem).toContain(BREADCRUMB_CLASSES.item);
    expect(helmLink).toContain(BREADCRUMB_CLASSES.link);
    expect(helmPage).toContain(BREADCRUMB_CLASSES.page);
    expect(helmSeparator).toContain(BREADCRUMB_CLASSES.separator);
  });
});
