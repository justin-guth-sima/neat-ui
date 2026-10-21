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
            the surrounding text.
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
  styles: `
    .icon-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 0.5rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
    }
  `,
})
export class IconsPage {
  protected readonly names = NEAT_ICON_NAMES;
}
