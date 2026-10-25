import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NeatViewport } from './viewport';

/**
 * A page in the shell's content area. It fills its parent and owns at most one scroll context:
 * with `scroll="body"` (the default) its body is the single scroll container; with
 * `scroll="none"` nothing scrolls and the content sizes itself to the page (for example a grid
 * that fits the screen).
 *
 * With `padding="page"` (the default) the content keeps the kit's page inset from the content
 * area's edges, so every app's pages line up; `padding="none"` lets full-bleed content (a video
 * grid, a map) reach the edges.
 *
 * Elements marked `neatPageAside` form the page's side panel (an inspector, say), shown on the
 * right while `aside="open"`. The panel is `--neat-aside-width` wide and scrolls on its own; the
 * body narrows beside it rather than being covered, keeping its own scroll setting. The aside is
 * the one supported second scroll context of a page. Closed, the panel and its content are out
 * of the DOM, but projected content is still instantiated (content projection always creates
 * it): gate expensive content with an `@if` of your own.
 *
 * On a narrow screen (`NeatViewport`) the panel floats over the right of the page instead,
 * `--neat-aside-width` wide but never wider than the page, and the body keeps the whole width.
 * There is no scrim and no Escape handling: the page owns the open state, and the toolbar's
 * `neat-aside-toggle` closes it. A page that keeps its panel's state should use `neatAsideOpen`,
 * which starts the panel closed on a narrow screen without overwriting the choice remembered
 * for a wide one.
 */
@Component({
  selector: 'neat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-aside]': "viewport.narrow() ? 'overlay' : 'beside'" },
  template: `
    <div class="body" [attr.data-scroll]="scroll()" [attr.data-padding]="padding()">
      <ng-content />
    </div>
    @if (aside() === 'open') {
      <aside class="in-data-[aside=overlay]:shadow-md">
        <ng-content select="[neatPageAside]" />
      </aside>
    }
  `,
  styleUrl: './page.css',
})
export class NeatPage {
  protected readonly viewport = inject(NeatViewport);

  readonly scroll = input<'body' | 'none'>('body');
  readonly padding = input<'page' | 'none'>('page');
  readonly aside = input<'open' | 'closed'>('closed');
}
