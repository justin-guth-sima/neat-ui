import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';

@Component({
  selector: 'app-page-page',
  imports: [NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Page</h2>
          <p>
            <code>neat-page</code> fills the shell's content area and owns the one scroll context
            below it. This page is longer than any screen on purpose: the shell, the top bar and the
            rail stay put while only this body scrolls.
          </p>
          <p>
            It also insets its content by the kit's page spacing, so pages line up across apps;
            <code>padding="none"</code> lets full-bleed content such as a video grid reach the
            edges.
          </p>
        </section>
        @for (section of sections; track section) {
          <section class="showcase-section">
            <h3>Section {{ section }}</h3>
            <p>
              Content like this belongs to the page, not to the shell. It never measures the shell's
              size and never sets a height, so the same page works in a small window, on a wall
              display and in kiosk mode, where the rail and the top bar are gone and the page gets
              the whole viewport.
            </p>
            <p class="showcase-muted">
              A page that needs more than one independently scrolling region is a kit change, not a
              workaround: raise it so the layout becomes a supported component.
            </p>
          </section>
        }
      </div>
    </neat-page>
  `,
})
export class PagePage {
  protected readonly sections = Array.from({ length: 20 }, (_, index) => index + 1);
}
