import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NeatIcon } from '../icon/icon';
import { BREADCRUMB_CLASSES } from './breadcrumb-classes';

/**
 * Helm's classes, plus what helm's parts get from elsewhere:
 * - a button crumb's pointer, corners and focus ring, which helm's anchor link does not need;
 * - a flex separator, which centers the chevron on the crumb's line: helm's `[&>neat-icon]:flex`
 *   does not take effect (the icon's own `inline-flex` is unlayered and outranks it), so the icon
 *   sat on a line box's top, 2.5px above the text's middle.
 */
const CLASSES = {
  ...BREADCRUMB_CLASSES,
  link: `${BREADCRUMB_CLASSES.link} cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`,
  separator: `${BREADCRUMB_CLASSES.separator} flex items-center`,
} as const;

/** A place on the way to where the user is: its name and, for the last, an optional detail. */
export interface NeatBreadcrumb {
  readonly label: string;
  /** Muted after the label; shown on the last crumb only, the place the user is at. */
  readonly detail?: string;
}

/**
 * Where the user is and the way back, as the kit's one breadcrumb.
 *
 * ```html
 * <neat-breadcrumbs label="Current folder" [crumbs]="crumbs()" (go)="open($event)" />
 * ```
 *
 * The file browser's folders and the diagram's levels use it.
 *
 * It is a `nav` named by `label`, around an ordered list. Each crumb but the last is an inline
 * button that emits its index on `go`. The last is plain text marked as the location
 * (`aria-current="location"`), with its detail muted after it.
 *
 * It takes Spartan's breadcrumb look: earlier crumbs muted, dark on hover, and the location in the
 * text color. A decorative chevron icon sits between
 * crumbs. A long path wraps onto further lines rather than scrolling.
 *
 * A pressed crumb is usually gone once the app goes there, since it becomes the last. So the app
 * moves the focus where the user's next step is.
 */
@Component({
  selector: 'neat-breadcrumbs',
  imports: [NeatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="label()">
      <ol [class]="classes.list">
        @for (crumb of crumbs(); track $index; let first = $first; let last = $last) {
          <li [class]="classes.item">
            @if (!first) {
              <span aria-hidden="true" [class]="classes.separator">
                <neat-icon name="next" [size]="16" />
              </span>
            }
            @if (last) {
              <!--
                Elements only, so no stray space joins the name; the detail's own space keeps it a
                word apart where it is read rather than seen.
              -->
              <span aria-current="location" [class]="classes.page">
                <span>{{ crumb.label }}</span>
                @if (crumb.detail) {
                  <span class="text-muted-foreground">{{ ' ' + crumb.detail }}</span>
                }
              </span>
            } @else {
              <button type="button" [class]="classes.link" (click)="go.emit($index)">
                {{ crumb.label }}
              </button>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class NeatBreadcrumbs {
  protected readonly classes = CLASSES;

  /** The landmark's accessible name ("Current folder", "Levels"). */
  readonly label = input.required<string>();
  /** From the first place to the one the user is at. */
  readonly crumbs = input.required<readonly NeatBreadcrumb[]>();
  /** The index of the crumb pressed. */
  readonly go = output<number>();
}
