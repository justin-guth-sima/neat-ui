import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { NeatAsideTitle, NeatCode, NeatInlineButton, NeatNote } from '@sima/neat-ui';
import { ApiPart } from './api-part';
import type { DocsTopicPart } from './docs-context';
import { PartRef } from './part-ref';

/** The jump list's links before the rest folds: about three lines of names at the default width. */
const JUMP_LINKS = 8;

/**
 * The topic's API in the page's side panel: the entry it comes from, a jump list of its parts,
 * then a section per part in the same order, the lead parts (those its examples show) first.
 */
@Component({
  selector: 'app-api-panel',
  imports: [ApiPart, NeatAsideTitle, NeatCode, NeatInlineButton, NeatNote, PartRef],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="title">
      <h2 neatAsideTitle>API</h2>
      @if (entry(); as entry) {
        <code neatCode class="showcase-muted">{{ entry }}</code>
      }
    </div>
    <nav class="jump" neatNote aria-label="Parts">
      @for (item of jump(); track item.part.name) {
        <code neatCode><app-part-ref [name]="item.part.name" /></code>
      }
      @if (folded() > 0) {
        <button
          neatInlineButton
          type="button"
          [attr.aria-expanded]="everyLink()"
          (click)="everyLink.set(!everyLink())"
        >
          {{ everyLink() ? 'Fewer' : '+ ' + folded() + ' more' }}
        </button>
      }
    </nav>
    @for (item of parts(); track item.part.name) {
      <app-api-part [part]="item.part" [intro]="introduced().has(item.part.name)" />
    }
  `,
  styleUrl: './api-panel.css',
})
export class ApiPanel {
  /** In the order the panel lists them. */
  readonly parts = input.required<readonly DocsTopicPart[]>();
  /** The parts the body introduces, whose doc the panel leaves out. */
  readonly introduced = input<ReadonlySet<string>>(new Set());

  protected readonly everyLink = signal(false);

  /** The import path every part shares; none for a topic that spans entries. */
  protected readonly entry = computed(() => {
    const imports = new Set(this.parts().map((item) => item.import));
    return imports.size === 1 ? [...imports][0] : null;
  });
  protected readonly folded = computed(() => Math.max(0, this.parts().length - JUMP_LINKS));
  protected readonly jump = computed(() =>
    this.everyLink() ? this.parts() : this.parts().slice(0, JUMP_LINKS),
  );
}
