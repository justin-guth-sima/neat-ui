import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NEAT_ICON_NAMES, NeatIcon, NeatPage } from '@sima/neat-ui';

@Component({
  selector: 'app-icons-page',
  imports: [NeatIcon, NeatPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <neat-page>
      <div class="showcase-page">
        <section class="showcase-section">
          <h2>Icons</h2>
          <p class="showcase-muted">
            Every name <code>neat-icon</code> accepts, drawn at 24 px. An icon takes its colour from
            the surrounding text. Play, pause and stop are the only filled glyphs: media controls
            are solid by convention, and everything else is an outline.
          </p>
          <div class="showcase-grid">
            @for (name of names; track name) {
              <div class="icon-card">
                <neat-icon [name]="name" [size]="24" />
                <span class="showcase-code">{{ name }}</span>
              </div>
            }
          </div>
        </section>
      </div>
    </neat-page>
  `,
  styleUrl: './icons.page.css',
})
export class IconsPage {
  protected readonly names = NEAT_ICON_NAMES;
}
