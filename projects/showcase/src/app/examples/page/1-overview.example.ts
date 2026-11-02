import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NeatButton,
  NeatPage,
  NeatPageTab,
  NeatPageTabs,
  NeatPageToolbar,
  NeatViewport,
} from '@sima/neat-ui';

/**
 * A page that fills the shell's content area and owns the one scroll context below it. It is
 * longer than any screen on purpose: the shell, the top bar and the rail stay put while only the
 * body scrolls. Its tools are in the top bar (`*neatPageToolbar`), where in kiosk mode they float
 * beside the exit control, and its views are page tabs that link to this example's second view.
 * Resize the window to see the tab row scroll sideways instead of wrapping.
 *
 * @page
 */
@Component({
  selector: 'app-overview',
  imports: [NeatButton, NeatPage, NeatPageTab, NeatPageTabs, NeatPageToolbar, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *neatPageToolbar>
      <button neatButton type="button" variant="text" size="small" (click)="many.set(!many())">
        {{ many() ? 'Fewer' : 'More' }} sections
      </button>
    </div>

    <neat-page>
      <nav neatPageTabs aria-label="Page example views">
        <a neatPageTab routerLink="/demo/page/overview">Overview</a>
        <a neatPageTab routerLink="/demo/page/details" activeMatch="subset">Details</a>
      </nav>
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
  protected readonly narrow = inject(NeatViewport).narrow;
  protected readonly many = signal(true);
  protected readonly sections = computed(() =>
    Array.from({ length: this.many() ? 20 : 3 }, (_, index) => index + 1),
  );
}
