import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatPage } from '@sima/neat-ui';

/** What the old Charts and Diagram pages are while their routes last: a note that they moved. */
@Component({
  selector: 'app-moved-page',
  imports: [NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Moved to the docs</h2>
          <p class="showcase-muted">
            This page's examples are topics of the Charts and Diagram groups in the rail.
          </p>
        </section>
      </div>
    </neat-page>
  `,
})
export class MovedPage {}
