import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NeatPage, NeatPageTab, NeatPageTabs } from '@sima/neat-ui';

/**
 * The second view of the page tabs: a route of its own, so the tab row is declared again and the
 * open tab follows the route. The tab for this view has `activeMatch="subset"`, which keeps it
 * open under routes nested below its own; the other keeps the default, its own path only. The
 * row stays where it is when the view changes, under the top bar and above the body.
 *
 * @page
 */
@Component({
  selector: 'app-details',
  imports: [NeatPage, NeatPageTab, NeatPageTabs, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <nav neatPageTabs aria-label="Page example views">
        <a neatPageTab routerLink="/demo/page/overview">Overview</a>
        <a neatPageTab routerLink="/demo/page/details" activeMatch="subset">Details</a>
      </nav>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Details</h2>
          <p>The same row as the overview's, on a route of its own.</p>
        </section>
      </div>
    </neat-page>
  `,
})
export class Details {}
