import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  NeatButton,
  NeatPage,
  NeatPageNav,
  type NeatPageNavGroup,
  NeatPageToolbar,
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
 * A page that fills the shell's content area and owns the one scroll context below it. It is
 * longer than any screen on purpose: the shell, the top bar and the rail stay put while only the
 * body scrolls. Its tools are in the top bar (`*neatPageToolbar`), where in kiosk mode they float
 * beside the exit control, and its page nav (`nav[neatPageNav]`) links its views: a column of its
 * own beside the body that stays put while the body scrolls, with a filter over its links at the
 * top (a long list wants one; this short one has it to show it). Make the window narrow to see the
 * list fold into a section above the body.
 *
 * @page
 */
@Component({
  selector: 'app-overview',
  imports: [NeatButton, NeatPage, NeatPageNav, NeatPageToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *neatPageToolbar>
      <button neatButton type="button" variant="text" size="small" (click)="many.set(!many())">
        {{ many() ? 'Fewer' : 'More' }} sections
      </button>
    </div>

    <neat-page>
      <nav
        neatPageNav
        aria-label="Page example"
        [groups]="pageNav"
        filterLabel="Filter views"
      ></nav>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Page</h2>
          <p>
            Content like this belongs to the page, not to the shell. It never measures the shell's
            size and never sets a height, so the same page works in a small window, on a wall
            display and in kiosk mode, where the rail and the top bar are gone and the page gets the
            whole viewport.
          </p>
          <p class="showcase-muted">
            The screen is {{ narrow() ? 'narrow, below 48rem' : 'wide' }}.
          </p>
        </section>
        @for (section of sections(); track section) {
          <section class="showcase-section">
            <h3>Section {{ section }}</h3>
            <p class="showcase-muted">More of the body, which is all that scrolls.</p>
          </section>
        }
      </div>
    </neat-page>
  `,
})
export class Overview {
  protected readonly pageNav = PAGE_NAV;
  protected readonly narrow = inject(NeatViewport).narrow;
  protected readonly many = signal(true);
  protected readonly sections = computed(() =>
    Array.from({ length: this.many() ? 20 : 3 }, (_, index) => index + 1),
  );
}
