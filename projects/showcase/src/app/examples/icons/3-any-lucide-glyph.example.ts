import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NeatIcon } from '@sima/neat-ui';
import { Anchor, Bell, Rocket } from '@sima/neat-ui/lucide';

/**
 * A glyph the kit's set has no name for, imported from `@sima/neat-ui/lucide` and given to the
 * icon as its `name`, at the kit's sizes. Reach for it only where no name of the set fits, and
 * never import Lucide from its own package: the kit keeps the icon library swappable.
 */
@Component({
  selector: 'app-any-lucide-glyph',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (glyph of glyphs; track glyph.label) {
      <div class="showcase-row">
        @for (size of sizes; track size) {
          <div class="sample">
            <neat-icon [name]="glyph.drawing" [size]="size" [label]="glyph.label" />
            <span class="showcase-code showcase-muted">{{ glyph.label }}, {{ size }} px</span>
          </div>
        }
      </div>
    }
  `,
  styleUrl: './any-lucide-glyph.example.css',
})
export class AnyLucideGlyph {
  protected readonly sizes = [16, 20, 24] as const;
  protected readonly glyphs = [
    { drawing: Rocket, label: 'Rocket' },
    { drawing: Anchor, label: 'Anchor' },
    { drawing: Bell, label: 'Bell' },
  ] as const;
}
