import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage, NeatPageNav, type NeatPageNavGroup } from '@sima/neat-ui';

const SIDE_LIST: readonly NeatPageNavGroup[] = [
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
 * The second view of the side list: a route of its own, so the list is declared again and its
 * open link follows the route. Network and Storage are routes nested under this one, which keep
 * this example rendered: of the links whose path the route is under, the longest is the open one,
 * so on `…/details/network` it is Network, not Details. The list stays where it is when the view
 * changes, beside the body; it has no filter here, which is the default.
 *
 * @page
 */
@Component({
  selector: 'app-details',
  imports: [NeatPage, NeatPageNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <nav neatPageNav aria-label="Page example" [groups]="sideList"></nav>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Details</h2>
          <p>The same list as the overview's, on a route of its own.</p>
        </section>
      </div>
    </neat-page>
  `,
})
export class Details {
  protected readonly sideList = SIDE_LIST;
}
