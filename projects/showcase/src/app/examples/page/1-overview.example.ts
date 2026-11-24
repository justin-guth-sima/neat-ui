import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  NeatButton,
  NeatPage,
  NeatPageNav,
  type NeatPageNavGroup,
  NeatPageToolbar,
  NeatPageToolbarDivider,
  NeatViewport,
} from '@sima/neat-ui';

const PAGE_NAV: readonly NeatPageNavGroup[] = [
  {
    label: 'Views',
    items: [
      { label: 'Overview', path: '/demo/page/overview' },
      { label: 'Details', path: '/demo/page/details' },
    ],
  },
  {
    label: 'Details',
    items: [
      { label: 'Network', path: '/demo/page/details/network' },
      { label: 'Storage', path: '/demo/page/details/storage' },
    ],
  },
];

/**
 * A page that fills the shell's content area and owns the one scroll context below it.
 *
 * It is longer than any screen on purpose. The shell, the top bar and the rail stay put, while only
 * the body scrolls.
 *
 * Its tools are in the top bar (`*neatPageToolbar`), a line between its two groups of them
 * (`neatPageToolbarDivider`). In kiosk mode they float beside the exit control.
 *
 * Its page nav (`nav[neatPageNav]`) links its views. It is a column of its own beside the body,
 * which stays put while the body scrolls. A filter sits over its links at the top: a long list
 * wants one, and this short one has it to show it.
 *
 * Try making the window narrow: the list folds into a section above the body.
 *
 * @page
 */
@Component({
  selector: 'app-overview',
  imports: [NeatButton, NeatPage, NeatPageNav, NeatPageToolbar, NeatPageToolbarDivider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './1-overview.example.html',
})
export class Overview {
  protected readonly pageNav = PAGE_NAV;
  protected readonly narrow = inject(NeatViewport).narrow;
  protected readonly many = signal(true);
  protected readonly sections = computed(() =>
    Array.from({ length: this.many() ? 20 : 3 }, (_, index) => index + 1),
  );
}
