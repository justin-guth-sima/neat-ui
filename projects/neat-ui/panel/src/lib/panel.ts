import {
  ChangeDetectionStrategy,
  Component,
  contentChild,
  Directive,
  input,
} from '@angular/core';

/** Numbers each panel, for the id its heading has. */
let nextPanelId = 0;

/**
 * Marks an element as one of a panel's header actions: `<button neatPanelActions>`. The panel
 * queries for it to learn whether it has any actions, so the area exists only when something is
 * projected into it; a content query finds only directives the app's template has matched, so an
 * app imports this one beside `NeatPanel`.
 */
@Directive({ selector: '[neatPanelActions]' })
export class NeatPanelActions {}

/**
 * A titled panel in the kit's card look:
 *
 * ```html
 * <neat-panel heading="Detections">
 *   <button neatButton neatPanelActions type="button" size="small">Clear</button>
 *   <p>Nothing yet.</p>
 * </neat-panel>
 * ```
 *
 * The heading stands at the start of the header, small and muted; elements marked
 * `neatPanelActions` (import `NeatPanelActions` for them) go to the header's end, and everything
 * else is the body. A panel without actions has no actions area at all, so its header keeps no gap
 * for one.
 *
 * The host is a named region (`role="region"`, labelled by the heading), the landmark a `section`
 * with a name maps to; a custom element is not a `section` of its own. The heading is an `h2`:
 * the panels are a page's sections.
 */
@Component({
  selector: 'neat-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'region',
    '[attr.aria-labelledby]': 'headingId',
  },
  template: `
    <div class="header" data-slot="panel-header">
      <h2 class="heading" data-slot="panel-heading" [id]="headingId">{{ heading() }}</h2>
      @if (actions()) {
        <div class="actions" data-slot="panel-actions">
          <ng-content select="[neatPanelActions]" />
        </div>
      }
    </div>
    <div data-slot="panel-body"><ng-content /></div>
  `,
  styleUrl: './panel.css',
})
export class NeatPanel {
  /** The panel's title, which also names it as a region. */
  readonly heading = input.required<string>();

  protected readonly headingId = `neat-panel-${++nextPanelId}-heading`;
  protected readonly actions = contentChild(NeatPanelActions);
}
