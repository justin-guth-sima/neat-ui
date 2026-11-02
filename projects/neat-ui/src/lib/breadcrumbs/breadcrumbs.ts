import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NeatInlineButton } from '../button/inline-button';

/** A place on the way to where the user is: its name and, for the last, an optional detail. */
export interface NeatBreadcrumb {
  readonly label: string;
  /** Muted after the label; shown on the last crumb only, the place the user is at. */
  readonly detail?: string;
}

/**
 * Where the user is and the way back, as the kit's one breadcrumb (the file browser's folders, the
 * diagram's levels):
 *
 * ```html
 * <neat-breadcrumbs label="Current folder" [crumbs]="crumbs()" (go)="open($event)" />
 * ```
 *
 * A `nav` named by `label` around an ordered list. Each crumb but the last is an inline button
 * that emits its index on `go`; the last is plain text marked as the location
 * (`aria-current="location"`), with its detail muted after it. A decorative "›" sits between
 * crumbs. A long path wraps onto further lines rather than scrolling. A pressed crumb is usually
 * gone once the app goes there (it becomes the last), so the app moves the focus where the user's
 * next step is.
 */
@Component({
  selector: 'neat-breadcrumbs',
  imports: [NeatInlineButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="label()">
      <ol class="m-0 flex list-none flex-wrap items-center gap-x-(--neat-space-2) p-0 text-sm">
        @for (crumb of crumbs(); track $index; let first = $first; let last = $last) {
          <li class="flex items-center gap-(--neat-space-2)">
            @if (!first) {
              <span aria-hidden="true" class="text-muted-foreground">›</span>
            }
            @if (last) {
              <!--
                Elements only, so no stray space joins the name; the detail's own space keeps it a
                word apart where it is read rather than seen.
              -->
              <span aria-current="location" class="font-medium">
                <span>{{ crumb.label }}</span>
                @if (crumb.detail) {
                  <span class="font-normal text-muted-foreground">{{ ' ' + crumb.detail }}</span>
                }
              </span>
            } @else {
              <button neatInlineButton type="button" (click)="go.emit($index)">
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
  /** The landmark's accessible name ("Current folder", "Levels"). */
  readonly label = input.required<string>();
  /** From the first place to the one the user is at. */
  readonly crumbs = input.required<readonly NeatBreadcrumb[]>();
  /** The index of the crumb pressed. */
  readonly go = output<number>();
}
