import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
 * the one supported second scroll context of a page. Closed, its content is not in the page.
 */
@Component({
  selector: 'neat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="body" [attr.data-scroll]="scroll()" [attr.data-padding]="padding()">
      <ng-content />
    </div>
    @if (aside() === 'open') {
      <aside>
        <ng-content select="[neatPageAside]" />
      </aside>
    }
  `,
  styleUrl: './page.css',
})
export class NeatPage {
  readonly scroll = input<'body' | 'none'>('body');
  readonly padding = input<'page' | 'none'>('page');
  readonly aside = input<'open' | 'closed'>('closed');
}
