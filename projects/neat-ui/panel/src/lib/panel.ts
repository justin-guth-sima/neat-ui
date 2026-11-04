import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

/** Numbers each panel, for the id its heading has. */
let nextPanelId = 0;

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
 * The heading stands at the start of the header, small and muted; elements with the attribute
 * `neatPanelActions` go to the header's end, and everything else is the body. The attribute is a
 * selector of the panel, not a directive, so it needs no import and cannot be forgotten into
 * silence. The actions area is always in the template and hidden while empty, so a panel without
 * actions shows no area and its header keeps no gap for one. The header is as tall with actions as
 * without, so panels side by side keep their bodies in line.
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
      <div class="actions" data-slot="panel-actions">
        <ng-content select="[neatPanelActions]" />
      </div>
    </div>
    <div data-slot="panel-body"><ng-content /></div>
  `,
  styleUrl: './panel.css',
})
export class NeatPanel {
  /** The panel's title, which also names it as a region. */
  readonly heading = input.required<string>();

  protected readonly headingId = `neat-panel-${++nextPanelId}-heading`;
}
